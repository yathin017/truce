// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ICoordinator
/// @notice Exclusivity registry: keepers race a cheap bonded `claim` for the right
///         to act on a `(taskId, subject)`, then execute through their own contract
///         which calls `consume` as its first instruction. The coordinator custodies
///         only bonds + bounty escrow and verifies *that the world changed* (via a
///         task-supplied predicate), never that any particular work was done.
/// @dev    Claims are keyed by `keccak256(taskId, subject)`; at most one is active per
///         subject at a time, so the compact per-claim state fits a single slot and the
///         claim stays cheap — the entire point on Monad.
interface ICoordinator {
    enum ClaimStatus {
        None,
        Active,
        Fulfilled,
        Released,
        Slashed
    }

    struct Task {
        address predicate; // eligibility oracle (immutable)
        bytes32 checkParam; // predicate config (immutable)
        uint32 windowBlocks; // exclusivity window (immutable)
        uint96 bondWei; // required claim bond (immutable)
        uint96 bountyPerJob; // paid to keeper on consume, 0 = self-funding (immutable)
        address sponsor; // registrant
        bool active; // sponsor may deactivate; blocks NEW claims only
    }

    /// @dev One storage slot: keeper (160) + expiryBlock (64) + status (8) = 232 bits.
    ///      The bond is not stored per-claim — it always equals the task's immutable
    ///      `bondWei` — which keeps a claim down to a single cold SSTORE.
    struct Claim {
        address keeper;
        uint64 expiryBlock;
        ClaimStatus status;
    }

    struct Stats {
        uint64 claims;
        uint64 fulfilled;
        uint64 slashed;
        uint64 released;
    }

    // ── events ────────────────────────────────────────────────────────────────
    event TaskRegistered(
        bytes32 indexed taskId,
        address indexed sponsor,
        address indexed predicate,
        bytes32 checkParam,
        uint32 windowBlocks,
        uint96 bondWei,
        uint96 bountyPerJob
    );
    event TaskFunded(bytes32 indexed taskId, address indexed from, uint256 amount);
    event TaskDeactivated(bytes32 indexed taskId);
    event TaskFundsWithdrawn(bytes32 indexed taskId, address indexed to, uint256 amount);

    event Claimed(
        bytes32 indexed taskId,
        bytes32 indexed subject,
        address indexed keeper,
        uint64 expiryBlock,
        uint96 bond
    );
    event Consumed(bytes32 indexed taskId, bytes32 indexed subject, address indexed keeper);
    event Resolved(
        bytes32 indexed taskId, bytes32 indexed subject, address indexed resolver, bool slashed, uint256 bond
    );
    event Withdrawal(address indexed account, uint256 amount);

    // ── registry ──────────────────────────────────────────────────────────────
    function registerTask(
        address predicate,
        bytes32 checkParam,
        uint32 windowBlocks,
        uint96 bondWei,
        uint96 bountyPerJob
    ) external payable returns (bytes32 taskId);

    function fundTask(bytes32 taskId) external payable;
    function deactivateTask(bytes32 taskId) external;
    function withdrawTaskFunds(bytes32 taskId, uint256 amount) external;

    // ── keeper lifecycle ──────────────────────────────────────────────────────
    function claim(bytes32 taskId, bytes32 subject) external payable returns (bytes32 subjectKey);
    function consume(bytes32 taskId, bytes32 subject) external;
    function resolve(bytes32 taskId, bytes32 subject) external;
    function withdraw() external;

    // ── views ─────────────────────────────────────────────────────────────────
    function isEligible(bytes32 taskId, bytes32 subject) external view returns (bool);
    function holder(bytes32 taskId, bytes32 subject) external view returns (address);
    function getClaim(bytes32 taskId, bytes32 subject) external view returns (Claim memory);
    function getTask(bytes32 taskId) external view returns (Task memory);
    function taskStats(bytes32 taskId)
        external
        view
        returns (uint64 claims, uint64 fulfilled, uint64 slashed, uint64 released);
    function computeTaskId(
        address predicate,
        bytes32 checkParam,
        uint32 windowBlocks,
        uint96 bondWei,
        uint96 bountyPerJob,
        address sponsor
    ) external pure returns (bytes32);
}
