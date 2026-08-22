// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICoordinator} from "./interfaces/ICoordinator.sol";
import {IEligibilityPredicate} from "./interfaces/IEligibilityPredicate.sol";

/// @title Coordinator
/// @notice A permissionless, protocol-agnostic exclusivity registry for keepers.
///         Contention is moved off the expensive execution transaction and onto a
///         cheap bonded `claim`. The winner's own executor calls `consume` as its
///         first line; the coordinator never executes work and custodies only bonds
///         and bounty escrow.
/// @dev    Claims are keyed by `keccak256(taskId, subject)` and the per-claim struct
///         fits one slot, so a claim is a single cold SSTORE plus the gas-capped
///         predicate check. Funds move only through the pull-payment `withdraw()`.
contract Coordinator is ICoordinator, ReentrancyGuard {
    /// @notice Hard gas cap for an external predicate call. On Monad the claimer pays
    ///         their full declared limit regardless, so a predicate must not be able
    ///         to burn it. Kept small (real predicates use <15k) so the 63/64 headroom
    ///         this forces does not inflate the minimum cheap-claim gas.
    uint256 public constant PREDICATE_GAS_CAP = 50_000;

    /// @notice Fixed slash reward (gas reimbursement only) to whoever calls `resolve`.
    ///         Fixed — not a percentage — so slashing is never profitable at scale.
    uint96 public constant SLASH_REWARD = 0.002 ether;

    mapping(bytes32 taskId => Task) private _tasks;
    mapping(bytes32 subjectKey => Claim) private _claims;
    mapping(bytes32 taskId => Stats) private _stats;

    /// @notice Bounty escrow held per task (funds available + reserved).
    mapping(bytes32 taskId => uint256) public taskEscrow;
    /// @notice Portion of `taskEscrow` reserved against currently-active claims.
    mapping(bytes32 taskId => uint256) public reservedEscrow;
    /// @notice Pull-payment balances (bonds refunded, bounties earned, sponsor withdrawals).
    mapping(address account => uint256) public withdrawable;
    /// @notice Slashed bond remainder — permanently non-withdrawable.
    uint256 public slashedPool;

    error PredicateZero();
    error WindowZero();
    error TaskExists();
    error UnknownTask();
    error NotSponsor();
    error TaskInactive();
    error WrongBond(uint96 expected, uint256 sent);
    error SubjectAlreadyClaimed();
    error NotEligible();
    error InsufficientEscrow();
    error NoActiveClaim();
    error NotClaimHolder();
    error ClaimExpired();
    error ClaimNotActive();
    error ClaimNotExpired();
    error NothingToWithdraw();
    error TransferFailed();

    // ─── registry ───────────────────────────────────────────────────────────────

    /// @inheritdoc ICoordinator
    function registerTask(
        address predicate,
        bytes32 checkParam,
        uint32 windowBlocks,
        uint96 bondWei,
        uint96 bountyPerJob
    ) external payable nonReentrant returns (bytes32 taskId) {
        if (predicate == address(0)) revert PredicateZero();
        if (windowBlocks == 0) revert WindowZero();

        taskId = computeTaskId(predicate, checkParam, windowBlocks, bondWei, bountyPerJob, msg.sender);
        if (_tasks[taskId].predicate != address(0)) revert TaskExists();

        _tasks[taskId] = Task({
            predicate: predicate,
            checkParam: checkParam,
            windowBlocks: windowBlocks,
            bondWei: bondWei,
            bountyPerJob: bountyPerJob,
            sponsor: msg.sender,
            active: true
        });

        if (msg.value > 0) taskEscrow[taskId] += msg.value;

        emit TaskRegistered(taskId, msg.sender, predicate, checkParam, windowBlocks, bondWei, bountyPerJob);
        if (msg.value > 0) emit TaskFunded(taskId, msg.sender, msg.value);
    }

    /// @inheritdoc ICoordinator
    function fundTask(bytes32 taskId) external payable nonReentrant {
        if (_tasks[taskId].predicate == address(0)) revert UnknownTask();
        taskEscrow[taskId] += msg.value;
        emit TaskFunded(taskId, msg.sender, msg.value);
    }

    /// @inheritdoc ICoordinator
    function deactivateTask(bytes32 taskId) external {
        Task storage t = _tasks[taskId];
        if (t.predicate == address(0)) revert UnknownTask();
        if (t.sponsor != msg.sender) revert NotSponsor();
        t.active = false;
        emit TaskDeactivated(taskId);
    }

    /// @inheritdoc ICoordinator
    /// @dev Only unreserved escrow (not backing an active claim's bounty) is withdrawable.
    function withdrawTaskFunds(bytes32 taskId, uint256 amount) external nonReentrant {
        Task storage t = _tasks[taskId];
        if (t.predicate == address(0)) revert UnknownTask();
        if (t.sponsor != msg.sender) revert NotSponsor();
        uint256 available = taskEscrow[taskId] - reservedEscrow[taskId];
        if (amount > available) revert InsufficientEscrow();
        taskEscrow[taskId] -= amount;
        withdrawable[msg.sender] += amount;
        emit TaskFundsWithdrawn(taskId, msg.sender, amount);
    }

    // ─── keeper lifecycle ─────────────────────────────────────────────────────────

    /// @inheritdoc ICoordinator
    function claim(bytes32 taskId, bytes32 subject) external payable nonReentrant returns (bytes32 key) {
        Task storage t = _tasks[taskId];
        if (t.predicate == address(0)) revert UnknownTask();
        if (!t.active) revert TaskInactive();
        if (msg.value != t.bondWei) revert WrongBond(t.bondWei, msg.value);

        key = _subjectKey(taskId, subject);
        Claim storage existing = _claims[key];
        if (existing.status == ClaimStatus.Active) {
            // Cheapest revert path: a live rival holds the claim. Losers stop here.
            if (block.number <= existing.expiryBlock) revert SubjectAlreadyClaimed();
            // Stale claim occupying the slot — auto-settle it (crediting this caller as
            // the resolver) then take over.
            _settle(taskId, subject, key, msg.sender);
        }

        // Predicate must confirm a live opportunity. Gas-capped, fail-closed.
        if (!_eligible(t.predicate, subject, t.checkParam)) revert NotEligible();

        if (t.bountyPerJob > 0) {
            if (taskEscrow[taskId] - reservedEscrow[taskId] < t.bountyPerJob) revert InsufficientEscrow();
            reservedEscrow[taskId] += t.bountyPerJob;
        }

        uint64 expiry = uint64(block.number + t.windowBlocks);
        _claims[key] = Claim({keeper: msg.sender, expiryBlock: expiry, status: ClaimStatus.Active});
        _stats[taskId].claims++;

        emit Claimed(taskId, subject, msg.sender, expiry, uint96(msg.value));
    }

    /// @inheritdoc ICoordinator
    /// @dev Called by the claim holder's executor as its first instruction. Gates on
    ///      exclusivity + window only; returns the bond and pays the bounty.
    function consume(bytes32 taskId, bytes32 subject) external nonReentrant {
        bytes32 key = _subjectKey(taskId, subject);
        Claim storage c = _claims[key];
        if (c.status != ClaimStatus.Active) revert NoActiveClaim();
        if (msg.sender != c.keeper) revert NotClaimHolder();
        if (block.number > c.expiryBlock) revert ClaimExpired();

        c.status = ClaimStatus.Fulfilled;
        _stats[taskId].fulfilled++;

        Task storage t = _tasks[taskId];
        uint256 payout = t.bondWei;
        if (t.bountyPerJob > 0) {
            reservedEscrow[taskId] -= t.bountyPerJob;
            taskEscrow[taskId] -= t.bountyPerJob;
            payout += t.bountyPerJob;
        }
        withdrawable[c.keeper] += payout;

        emit Consumed(taskId, subject, c.keeper);
    }

    /// @inheritdoc ICoordinator
    function resolve(bytes32 taskId, bytes32 subject) external nonReentrant {
        bytes32 key = _subjectKey(taskId, subject);
        Claim storage c = _claims[key];
        if (c.status != ClaimStatus.Active) revert ClaimNotActive();
        if (block.number <= c.expiryBlock) revert ClaimNotExpired();
        _settle(taskId, subject, key, msg.sender);
    }

    /// @inheritdoc ICoordinator
    function withdraw() external nonReentrant {
        uint256 amount = withdrawable[msg.sender];
        if (amount == 0) revert NothingToWithdraw();
        withdrawable[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Withdrawal(msg.sender, amount);
    }

    // ─── internal ─────────────────────────────────────────────────────────────────

    /// @dev Settle an expired, still-Active claim. Slash if the opportunity is still
    ///      live (griefing), refund if it has legitimately evaporated (self-heal).
    function _settle(bytes32 taskId, bytes32 subject, bytes32 key, address resolver) internal {
        Claim storage c = _claims[key];
        Task storage t = _tasks[taskId];

        // Unreserve any bounty held against this claim (stays in escrow).
        if (t.bountyPerJob > 0 && reservedEscrow[taskId] >= t.bountyPerJob) {
            reservedEscrow[taskId] -= t.bountyPerJob;
        }

        uint256 bond = t.bondWei;
        address keeper = c.keeper;
        bool stillEligible = _eligible(t.predicate, subject, t.checkParam);

        if (stillEligible) {
            c.status = ClaimStatus.Slashed;
            _stats[taskId].slashed++;
            uint256 reward = bond >= SLASH_REWARD ? SLASH_REWARD : bond;
            if (reward > 0) withdrawable[resolver] += reward;
            slashedPool += bond - reward;
            emit Resolved(taskId, subject, resolver, true, bond);
        } else {
            c.status = ClaimStatus.Released;
            _stats[taskId].released++;
            if (bond > 0) withdrawable[keeper] += bond;
            emit Resolved(taskId, subject, resolver, false, bond);
        }
    }

    /// @dev Gas-capped, fail-closed eligibility check.
    function _eligible(address predicate, bytes32 subject, bytes32 checkParam) internal view returns (bool) {
        // EIP-150 63/64 rule: ensure the callee cannot receive more than the cap.
        if (gasleft() < PREDICATE_GAS_CAP * 64 / 63 + 5_000) return false;
        (bool ok, bytes memory ret) = predicate.staticcall{gas: PREDICATE_GAS_CAP}(
            abi.encodeWithSelector(IEligibilityPredicate.isEligible.selector, subject, checkParam)
        );
        if (!ok || ret.length != 32) return false; // revert / garbage ⇒ ineligible
        return abi.decode(ret, (bool));
    }

    function _subjectKey(bytes32 taskId, bytes32 subject) internal pure returns (bytes32) {
        return keccak256(abi.encode(taskId, subject));
    }

    // ─── views ──────────────────────────────────────────────────────────────────

    /// @inheritdoc ICoordinator
    function isEligible(bytes32 taskId, bytes32 subject) external view returns (bool) {
        Task storage t = _tasks[taskId];
        if (t.predicate == address(0)) return false;
        return _eligible(t.predicate, subject, t.checkParam);
    }

    /// @inheritdoc ICoordinator
    /// @dev Returns the keeper with live, unexpired exclusive rights, else address(0).
    ///      This is the one line a protocol integrates to enforce exclusivity.
    function holder(bytes32 taskId, bytes32 subject) external view returns (address) {
        Claim storage c = _claims[_subjectKey(taskId, subject)];
        if (c.status == ClaimStatus.Active && block.number <= c.expiryBlock) return c.keeper;
        return address(0);
    }

    /// @inheritdoc ICoordinator
    function getClaim(bytes32 taskId, bytes32 subject) external view returns (Claim memory) {
        return _claims[_subjectKey(taskId, subject)];
    }

    /// @inheritdoc ICoordinator
    function getTask(bytes32 taskId) external view returns (Task memory) {
        return _tasks[taskId];
    }

    /// @inheritdoc ICoordinator
    function taskStats(bytes32 taskId)
        external
        view
        returns (uint64 claims, uint64 fulfilled, uint64 slashed, uint64 released)
    {
        Stats storage s = _stats[taskId];
        return (s.claims, s.fulfilled, s.slashed, s.released);
    }

    /// @inheritdoc ICoordinator
    function computeTaskId(
        address predicate,
        bytes32 checkParam,
        uint32 windowBlocks,
        uint96 bondWei,
        uint96 bountyPerJob,
        address sponsor
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(predicate, checkParam, windowBlocks, bondWei, bountyPerJob, sponsor));
    }
}
