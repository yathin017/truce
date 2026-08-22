// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";
import {TaskEncoding} from "../src/lib/TaskEncoding.sol";

import {MockOracle} from "../src/mocks/MockOracle.sol";
import {MockArbPool} from "../src/mocks/MockArbPool.sol";
import {MockCronJob} from "../src/mocks/MockCronJob.sol";
import {ClaimEnforced} from "../src/mocks/ClaimEnforced.sol";

import {ArbJobExecutor} from "../src/executors/ArbJobExecutor.sol";
import {HarvestExecutor} from "../src/executors/HarvestExecutor.sol";
import {PriceDivergencePredicate} from "../src/predicates/PriceDivergencePredicate.sol";
import {IntervalPredicate} from "../src/predicates/IntervalPredicate.sol";

/// @notice The arena job contracts must be once-until-reset so a naive race produces real
///         losers, and gate the expensive action on the claim for the coordinated path.
contract ArenaJobsTest is Test {
    Coordinator internal coord;

    uint96 internal constant BOND = 1 ether;
    uint32 internal constant WINDOW = 5;
    uint16 internal constant BPS = 100; // 1%

    address internal operator = makeAddr("operator");
    address internal rival = makeAddr("rival");

    function setUp() public {
        vm.warp(1_000_000); // realistic timestamp so interval math matches a live chain
        coord = new Coordinator();
        vm.deal(operator, 100 ether);
        vm.deal(rival, 100 ether);
    }

    // ── MockArbPool ───────────────────────────────────────────────────────────────

    function test_arb_naive_onceUntilReset() public {
        MockOracle oracle = new MockOracle(1_000e18);
        MockArbPool pool = new MockArbPool(coord, oracle, BPS); // voluntary (taskId unset)

        assertFalse(pool.diverged());
        pool.pushOffPeg(1_050e18); // reset/refill → 5% off peg
        assertTrue(pool.diverged());

        pool.arb(); // first lands (voluntary: onlyHolder bypassed)
        assertFalse(pool.diverged(), "price not corrected");

        vm.expectRevert(bytes("pegged")); // a naive loser reverts
        pool.arb();
    }

    function test_arb_coordinated_endToEnd() public {
        MockOracle oracle = new MockOracle(1_000e18);
        MockArbPool pool = new MockArbPool(coord, oracle, BPS);
        PriceDivergencePredicate pred = new PriceDivergencePredicate();

        bytes32 checkParam = TaskEncoding.packPriceParam(BPS, address(oracle));
        bytes32 subject = pool.subject();
        bytes32 taskId = coord.registerTask(address(pred), checkParam, WINDOW, BOND, 0);
        pool.setTaskId(taskId);

        pool.pushOffPeg(1_050e18);
        assertTrue(coord.isEligible(taskId, subject));

        ArbJobExecutor exec = new ArbJobExecutor(coord, operator);
        vm.prank(operator);
        exec.reserve{value: BOND}(taskId, subject);
        vm.prank(operator);
        exec.perform(taskId, subject, "");

        assertFalse(coord.isEligible(taskId, subject), "predicate should have flipped false");
        assertEq(coord.withdrawable(address(exec)), BOND);
    }

    function test_arb_enforcement_blocksNonHolder() public {
        MockOracle oracle = new MockOracle(1_000e18);
        MockArbPool pool = new MockArbPool(coord, oracle, BPS);
        PriceDivergencePredicate pred = new PriceDivergencePredicate();
        bytes32 taskId = coord.registerTask(
            address(pred), TaskEncoding.packPriceParam(BPS, address(oracle)), WINDOW, BOND, 0
        );
        pool.setTaskId(taskId);
        pool.pushOffPeg(1_050e18);

        vm.prank(rival);
        vm.expectRevert(ClaimEnforced.NotClaimHolder.selector);
        pool.arb();
    }

    // ── MockCronJob ───────────────────────────────────────────────────────────────

    function test_cron_naive_onceUntilRefill() public {
        MockCronJob job = new MockCronJob(coord, 1 hours); // voluntary

        assertFalse(job.due());
        job.refill(); // reset/refill backdates lastHarvest → due
        assertTrue(job.due());

        job.harvest(); // first lands
        assertEq(job.harvestCount(), 1);
        // interval (1h) > any race span, so it stays not-due until the next refill.
        assertFalse(job.due(), "should not be due right after harvest");

        vm.expectRevert(bytes("not due")); // a naive loser reverts
        job.harvest();
    }

    function test_cron_coordinated_endToEnd_withBounty() public {
        MockCronJob job = new MockCronJob(coord, 1 hours);
        IntervalPredicate pred = new IntervalPredicate();

        uint96 bounty = 0.1 ether;
        bytes32 subject = job.subject();
        bytes32 taskId = coord.registerTask{value: 1 ether}(
            address(pred), bytes32(uint256(1 hours)), WINDOW, BOND, bounty
        );
        job.setTaskId(taskId);

        job.refill();
        assertTrue(coord.isEligible(taskId, subject));

        HarvestExecutor exec = new HarvestExecutor(coord, operator);
        vm.prank(operator);
        exec.reserve{value: BOND}(taskId, subject);
        vm.prank(operator);
        exec.perform(taskId, subject, "");

        assertEq(job.harvestCount(), 1, "job not harvested");
        assertFalse(coord.isEligible(taskId, subject), "predicate should have flipped false");
        assertEq(coord.withdrawable(address(exec)), BOND + bounty, "bond+bounty not paid");
    }
}
