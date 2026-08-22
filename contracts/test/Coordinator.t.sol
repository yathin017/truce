// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";
import {SubjectFlagPredicate} from "./helpers/TestPredicates.sol";

contract CoordinatorTest is Test {
    Coordinator internal coord;
    SubjectFlagPredicate internal pred;

    address internal sponsor = makeAddr("sponsor");
    address internal k1 = makeAddr("k1");
    address internal k2 = makeAddr("k2");
    address internal resolver = makeAddr("resolver");

    uint96 internal constant BOND = 1 ether;
    uint32 internal constant WINDOW = 5;
    bytes32 internal constant SUBJECT = bytes32(uint256(0xA11CE));

    bytes32 internal taskId;

    function setUp() public {
        coord = new Coordinator();
        pred = new SubjectFlagPredicate();
        vm.prank(sponsor);
        taskId = coord.registerTask(address(pred), bytes32(0), WINDOW, BOND, 0);
        pred.setEligible(SUBJECT, true);
        vm.deal(sponsor, 10 ether);
        vm.deal(k1, 10 ether);
        vm.deal(k2, 10 ether);
    }

    function _claim(address who) internal returns (bytes32) {
        vm.prank(who);
        return coord.claim{value: BOND}(taskId, SUBJECT);
    }

    // ── registration ───────────────────────────────────────────────────────────

    function test_computeTaskId_matches() public view {
        assertEq(taskId, coord.computeTaskId(address(pred), bytes32(0), WINDOW, BOND, 0, sponsor));
    }

    function test_register_reverts_onZeroPredicate() public {
        vm.expectRevert(Coordinator.PredicateZero.selector);
        coord.registerTask(address(0), bytes32(0), WINDOW, BOND, 0);
    }

    function test_register_reverts_onZeroWindow() public {
        vm.expectRevert(Coordinator.WindowZero.selector);
        coord.registerTask(address(pred), bytes32(0), 0, BOND, 0);
    }

    function test_register_reverts_onDuplicate() public {
        vm.prank(sponsor);
        vm.expectRevert(Coordinator.TaskExists.selector);
        coord.registerTask(address(pred), bytes32(0), WINDOW, BOND, 0);
    }

    // ── happy path ───────────────────────────────────────────────────────────────

    function test_claim_consume_refundsBond() public {
        bytes32 claimId = _claim(k1);
        assertEq(coord.holder(taskId, SUBJECT), k1);

        vm.prank(k1);
        coord.consume(taskId, SUBJECT);

        ICoordinator.Claim memory c = coord.getClaim(taskId, SUBJECT);
        assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Fulfilled));
        assertEq(coord.holder(taskId, SUBJECT), address(0), "slot not freed");
        assertEq(coord.withdrawable(k1), BOND, "bond not refunded");

        (, uint64 fulfilled,,) = coord.taskStats(taskId);
        assertEq(fulfilled, 1);

        uint256 before = k1.balance;
        vm.prank(k1);
        coord.withdraw();
        assertEq(k1.balance - before, BOND);
    }

    // ── the race: loser reverts cheaply ──────────────────────────────────────────

    function test_secondClaimer_revertsWhileActive() public {
        _claim(k1);
        vm.prank(k2);
        vm.expectRevert(Coordinator.SubjectAlreadyClaimed.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
    }

    function test_claim_reverts_onWrongBond() public {
        vm.prank(k1);
        vm.expectRevert(abi.encodeWithSelector(Coordinator.WrongBond.selector, BOND, uint256(0.5 ether)));
        coord.claim{value: 0.5 ether}(taskId, SUBJECT);
    }

    function test_claim_reverts_whenNotEligible() public {
        pred.setEligible(SUBJECT, false);
        vm.prank(k1);
        vm.expectRevert(Coordinator.NotEligible.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
    }

    // ── consume guards ───────────────────────────────────────────────────────────

    function test_consume_reverts_forNonHolder() public {
        _claim(k1);
        vm.prank(k2);
        vm.expectRevert(Coordinator.NotClaimHolder.selector);
        coord.consume(taskId, SUBJECT);
    }

    function test_consume_reverts_whenNoClaim() public {
        vm.prank(k1);
        vm.expectRevert(Coordinator.NoActiveClaim.selector);
        coord.consume(taskId, SUBJECT);
    }

    // ── window boundaries ────────────────────────────────────────────────────────

    function test_consume_atExpiryBlock_ok() public {
        uint256 start = block.number;
        _claim(k1);
        vm.roll(start + WINDOW); // block.number == expiryBlock
        vm.prank(k1);
        coord.consume(taskId, SUBJECT); // still valid at the boundary
    }

    function test_consume_afterExpiry_reverts() public {
        uint256 start = block.number;
        _claim(k1);
        vm.roll(start + WINDOW + 1); // one past expiry
        vm.prank(k1);
        vm.expectRevert(Coordinator.ClaimExpired.selector);
        coord.consume(taskId, SUBJECT);
    }

    function test_resolve_beforeExpiry_reverts() public {
        bytes32 claimId = _claim(k1);
        vm.expectRevert(Coordinator.ClaimNotExpired.selector);
        coord.resolve(taskId, SUBJECT);
    }

    // ── resolve: grief slash vs self-heal refund ─────────────────────────────────

    function test_resolve_slashes_whenStillEligible() public {
        bytes32 claimId = _claim(k1);
        vm.roll(block.number + WINDOW + 1);

        vm.prank(resolver);
        coord.resolve(taskId, SUBJECT);

        ICoordinator.Claim memory c = coord.getClaim(taskId, SUBJECT);
        assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Slashed));
        assertEq(coord.withdrawable(resolver), coord.SLASH_REWARD());
        assertEq(coord.slashedPool(), BOND - coord.SLASH_REWARD());
        assertEq(coord.holder(taskId, SUBJECT), address(0), "slot not reopened");

        (,, uint64 slashed,) = coord.taskStats(taskId);
        assertEq(slashed, 1);
    }

    function test_resolve_refunds_whenSelfHealed() public {
        bytes32 claimId = _claim(k1);
        pred.setEligible(SUBJECT, false); // borrower repaid — opportunity gone
        vm.roll(block.number + WINDOW + 1);

        vm.prank(resolver);
        coord.resolve(taskId, SUBJECT);

        ICoordinator.Claim memory c = coord.getClaim(taskId, SUBJECT);
        assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Released));
        assertEq(coord.withdrawable(k1), BOND, "bond not refunded to keeper");
        assertEq(coord.slashedPool(), 0);

        (,,, uint64 released) = coord.taskStats(taskId);
        assertEq(released, 1);
    }

    // ── permissionless takeover after expiry via claim() ─────────────────────────

    function test_claim_takesOverExpiredClaim_andSlashesGriefer() public {
        _claim(k1);
        vm.roll(block.number + WINDOW + 1); // k1 griefs, still eligible

        _claim(k2); // inline-settles k1 (slash), k2 takes over the subject

        (,, uint64 slashed,) = coord.taskStats(taskId);
        assertEq(slashed, 1, "griefer not slashed");
        assertEq(coord.withdrawable(k2), coord.SLASH_REWARD(), "takeover resolver reward");
        assertEq(coord.holder(taskId, SUBJECT), k2, "k2 not the new holder");

        ICoordinator.Claim memory c = coord.getClaim(taskId, SUBJECT);
        assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Active));
        assertEq(c.keeper, k2);
    }

    // ── bounty escrow flow ───────────────────────────────────────────────────────

    function test_bounty_paidOnConsume_andEscrowAccounting() public {
        uint96 bounty = 0.1 ether;
        vm.prank(sponsor);
        bytes32 bTask = coord.registerTask{value: 1 ether}(address(pred), bytes32("b"), WINDOW, BOND, bounty);

        vm.prank(k1);
        coord.claim{value: BOND}(bTask, SUBJECT);
        assertEq(coord.reservedEscrow(bTask), bounty, "bounty not reserved");

        vm.prank(k1);
        coord.consume(bTask, SUBJECT);

        assertEq(coord.withdrawable(k1), BOND + bounty, "bond+bounty not credited");
        assertEq(coord.taskEscrow(bTask), 1 ether - bounty, "escrow not debited");
        assertEq(coord.reservedEscrow(bTask), 0, "reservation not cleared");
    }

    function test_withdrawTaskFunds_respectsReservation() public {
        uint96 bounty = 0.1 ether;
        vm.prank(sponsor);
        bytes32 bTask = coord.registerTask{value: 1 ether}(address(pred), bytes32("b"), WINDOW, BOND, bounty);

        vm.prank(k1);
        coord.claim{value: BOND}(bTask, SUBJECT); // reserves 0.1

        vm.prank(sponsor);
        vm.expectRevert(Coordinator.InsufficientEscrow.selector);
        coord.withdrawTaskFunds(bTask, 1 ether); // only 0.9 is unreserved

        vm.prank(sponsor);
        coord.withdrawTaskFunds(bTask, 0.9 ether);
        assertEq(coord.withdrawable(sponsor), 0.9 ether);
    }

    // ── deactivation blocks new claims only ──────────────────────────────────────

    function test_deactivate_blocksNewClaims_butActiveConsumeSucceeds() public {
        _claim(k1);
        vm.prank(sponsor);
        coord.deactivateTask(taskId);

        // existing holder can still finish
        vm.prank(k1);
        coord.consume(taskId, SUBJECT);

        // new claims are blocked
        vm.prank(k2);
        vm.expectRevert(Coordinator.TaskInactive.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
    }

    function test_deactivate_reverts_forNonSponsor() public {
        vm.prank(k1);
        vm.expectRevert(Coordinator.NotSponsor.selector);
        coord.deactivateTask(taskId);
    }
}
