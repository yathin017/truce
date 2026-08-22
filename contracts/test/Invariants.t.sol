// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";
import {SubjectFlagPredicate} from "./helpers/TestPredicates.sol";

/// @dev Drives the Coordinator through random keeper lifecycles across a fixed set of
///      subjects, tracking enough shadow state to assert the accounting invariants.
contract CoordinatorHandler is Test {
    Coordinator public coord;
    SubjectFlagPredicate public pred;
    bytes32 public taskId;

    uint96 internal constant BOND = 1 ether;
    uint32 internal constant WINDOW = 3;

    address[4] internal keepers = [makeAddr("h_k1"), makeAddr("h_k2"), makeAddr("h_k3"), makeAddr("h_k4")];
    bytes32[4] internal subjects =
        [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4))];

    constructor(Coordinator _coord, SubjectFlagPredicate _pred, bytes32 _taskId) {
        coord = _coord;
        pred = _pred;
        taskId = _taskId;
        for (uint256 i; i < keepers.length; ++i) {
            vm.deal(keepers[i], 1_000 ether);
        }
        for (uint256 i; i < subjects.length; ++i) {
            pred.setEligible(subjects[i], true);
        }
    }

    function subjectAt(uint256 i) external view returns (bytes32) {
        return subjects[i % subjects.length];
    }

    function claim(uint256 kSeed, uint256 sSeed) external {
        address k = keepers[kSeed % keepers.length];
        bytes32 s = subjects[sSeed % subjects.length];
        vm.prank(k);
        try coord.claim{value: BOND}(taskId, s) {} catch {}
    }

    function consume(uint256 sSeed) external {
        bytes32 s = subjects[sSeed % subjects.length];
        address h = coord.holder(taskId, s);
        if (h == address(0)) return;
        vm.prank(h);
        try coord.consume(taskId, s) {} catch {}
    }

    function resolveByIndex(uint256 idx) external {
        bytes32 s = subjects[idx % subjects.length];
        try coord.resolve(taskId, s) {} catch {}
    }

    function toggleSelfHeal(uint256 sSeed, bool v) external {
        bytes32 s = subjects[sSeed % subjects.length];
        pred.setEligible(s, v);
    }

    function roll(uint256 n) external {
        vm.roll(block.number + (n % (WINDOW + 2)));
    }

    function withdrawFor(uint256 kSeed) external {
        address k = keepers[kSeed % keepers.length];
        vm.prank(k);
        try coord.withdraw() {} catch {}
    }

    // sum of active bonds + withdrawable(keepers) — for the balance invariant
    function sumKeeperWithdrawable() external view returns (uint256 total) {
        for (uint256 i; i < keepers.length; ++i) {
            total += coord.withdrawable(keepers[i]);
        }
    }
}

contract InvariantsTest is StdInvariant, Test {
    Coordinator internal coord;
    SubjectFlagPredicate internal pred;
    CoordinatorHandler internal handler;
    address internal sponsor = makeAddr("inv_sponsor");
    bytes32 internal taskId;

    uint32 internal constant WINDOW = 3;
    uint96 internal constant BOND = 1 ether;

    function setUp() public {
        coord = new Coordinator();
        pred = new SubjectFlagPredicate();
        vm.prank(sponsor);
        taskId = coord.registerTask(address(pred), bytes32(0), WINDOW, BOND, 0);
        handler = new CoordinatorHandler(coord, pred, taskId);
        targetContract(address(handler));
    }

    /// Invariant 3: contract balance is fully accounted by withdrawable + active bonds
    /// + escrow + slashedPool. (No bounty on this task, so escrow == 0.)
    function invariant_solvency() public view {
        uint256 activeBonds;
        for (uint256 i; i < 4; ++i) {
            ICoordinator.Claim memory c = coord.getClaim(taskId, handler.subjectAt(i));
            // Bond is not stored per-claim; an active claim locks exactly the task bond.
            if (c.status == ICoordinator.ClaimStatus.Active) activeBonds += BOND;
        }
        uint256 accounted = handler.sumKeeperWithdrawable() + coord.withdrawable(sponsor)
            + coord.withdrawable(address(handler)) + activeBonds + coord.slashedPool()
            + coord.taskEscrow(taskId);
        assertEq(address(coord).balance, accounted, "balance not fully accounted");
    }

    /// Invariant 2 + 4: at most one Active claim per subject, and the holder view is
    /// consistent with an unexpired Active claim.
    function invariant_atMostOneHolderPerSubject() public view {
        bytes32[4] memory subjects =
            [bytes32(uint256(1)), bytes32(uint256(2)), bytes32(uint256(3)), bytes32(uint256(4))];
        for (uint256 i; i < subjects.length; ++i) {
            ICoordinator.Claim memory c = coord.getClaim(taskId, subjects[i]);
            address h = coord.holder(taskId, subjects[i]);
            if (h != address(0)) {
                assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Active));
                assertGe(c.expiryBlock, block.number);
                assertEq(h, c.keeper);
            }
        }
    }

    /// slashedPool is monotonic non-decreasing (never paid out).
    uint256 internal _lastSlashed;

    function invariant_slashedPoolMonotonic() public {
        uint256 cur = coord.slashedPool();
        assertGe(cur, _lastSlashed, "slashedPool decreased");
        _lastSlashed = cur;
    }
}
