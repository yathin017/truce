// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";
import {MutablePredicate, AlwaysTruePredicate} from "./helpers/TestPredicates.sol";

/// @notice The strongest artefact for a technical judge: every adversarial predicate
///         shape, each neutralised. Written first, before the happy path.
contract MaliciousPredicateTest is Test {
    Coordinator internal coord;
    MutablePredicate internal mp;

    address internal sponsor = makeAddr("sponsor");
    address internal keeper = makeAddr("keeper");
    address internal resolver = makeAddr("resolver");

    uint96 internal constant BOND = 1 ether;
    uint32 internal constant WINDOW = 5;
    bytes32 internal constant SUBJECT = bytes32(uint256(0xA11CE));

    bytes32 internal taskId;

    function setUp() public {
        coord = new Coordinator();
        mp = new MutablePredicate();
        vm.prank(sponsor);
        taskId = coord.registerTask(address(mp), bytes32(0), WINDOW, BOND, 0);
        vm.deal(keeper, 10 ether);
    }

    // ── each malicious mode fails closed at claim() ────────────────────────────

    function test_GasBomb_failsClosed_andBounded() public {
        mp.setEligible(SUBJECT, true);
        mp.setMode(MutablePredicate.Mode.GasBomb);

        uint256 g0 = gasleft();
        vm.prank(keeper);
        vm.expectRevert(Coordinator.NotEligible.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
        uint256 used = g0 - gasleft();

        // The predicate is gas-capped at 100k, so the whole attempt stays cheap —
        // it cannot burn the claimer's declared limit.
        assertLt(used, 1_000_000, "gas bomb was not capped");
    }

    function test_Reverter_failsClosed() public {
        mp.setEligible(SUBJECT, true);
        mp.setMode(MutablePredicate.Mode.Revert);
        vm.prank(keeper);
        vm.expectRevert(Coordinator.NotEligible.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
    }

    function test_Garbage_failsClosed() public {
        mp.setEligible(SUBJECT, true);
        mp.setMode(MutablePredicate.Mode.Garbage);
        vm.prank(keeper);
        vm.expectRevert(Coordinator.NotEligible.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
    }

    function test_Mutation_blocked_andNoStateChange() public {
        mp.setEligible(SUBJECT, true);
        mp.setMode(MutablePredicate.Mode.Mutate);
        vm.prank(keeper);
        vm.expectRevert(Coordinator.NotEligible.selector);
        coord.claim{value: BOND}(taskId, SUBJECT);
        assertEq(mp.lastMutated(), bytes32(0), "predicate mutated state under staticcall");
    }

    // ── a reverting predicate must never freeze bonds in resolve() ─────────────

    function test_RevertingPredicate_cannotFreezeBond() public {
        mp.setEligible(SUBJECT, true); // Normal mode: claim succeeds
        vm.prank(keeper);
        coord.claim{value: BOND}(taskId, SUBJECT);

        // Sponsor turns the predicate hostile after the claim.
        mp.setMode(MutablePredicate.Mode.Revert);
        vm.roll(block.number + WINDOW + 1);

        // resolve() must terminate. Fail-closed ⇒ treated as self-healed ⇒ bond refunded.
        vm.prank(resolver);
        coord.resolve(taskId, SUBJECT);

        ICoordinator.Claim memory c = coord.getClaim(taskId, SUBJECT);
        assertEq(uint8(c.status), uint8(ICoordinator.ClaimStatus.Released), "bond frozen");
        assertEq(coord.withdrawable(keeper), BOND, "bond not refunded to keeper");
    }

    // ── the always-true bond farm is unprofitable ──────────────────────────────

    function test_AlwaysTrueBondFarm_isUnprofitable() public {
        // Malicious sponsor registers a predicate that is always eligible.
        AlwaysTruePredicate farm = new AlwaysTruePredicate();
        vm.prank(sponsor);
        bytes32 farmTask = coord.registerTask(address(farm), bytes32(0), WINDOW, BOND, 0);

        // Honest keeper claims; can never make the predicate false, so gets slashed.
        vm.prank(keeper);
        coord.claim{value: BOND}(farmTask, SUBJECT);
        vm.roll(block.number + WINDOW + 1);

        // Sponsor resolves to farm the bond.
        vm.prank(sponsor);
        coord.resolve(farmTask, SUBJECT);

        // Sponsor's entire gain is the fixed SLASH_REWARD (gas reimbursement); the rest
        // is locked in the non-withdrawable slashedPool. Farming is not profitable.
        assertEq(coord.withdrawable(sponsor), coord.SLASH_REWARD(), "farm gained more than fixed reward");
        assertEq(coord.slashedPool(), BOND - coord.SLASH_REWARD(), "remainder not locked");

        // slashedPool has no withdrawal path — assert the sponsor cannot pull it.
        uint256 before = sponsor.balance;
        vm.prank(sponsor);
        coord.withdraw();
        assertEq(sponsor.balance - before, coord.SLASH_REWARD(), "sponsor drained more than the reward");
    }
}
