// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Coordinator} from "../src/Coordinator.sol";
import {ICoordinator} from "../src/interfaces/ICoordinator.sol";
import {TaskEncoding} from "../src/lib/TaskEncoding.sol";

import {MockOracle} from "../src/mocks/MockOracle.sol";
import {EnforcedMockPool} from "../src/mocks/EnforcedMockPool.sol";
import {ClaimEnforced} from "../src/mocks/ClaimEnforced.sol";
import {MockVault} from "../src/mocks/MockVault.sol";

import {AaveHealthPredicate} from "../src/predicates/AaveHealthPredicate.sol";
import {PriceDivergencePredicate} from "../src/predicates/PriceDivergencePredicate.sol";
import {IntervalPredicate} from "../src/predicates/IntervalPredicate.sol";

import {AaveLiquidationExecutor} from "../src/executors/AaveLiquidationExecutor.sol";
import {DexArbExecutor} from "../src/executors/DexArbExecutor.sol";
import {HarvestExecutor} from "../src/executors/HarvestExecutor.sol";

/// @notice End-to-end integration for all three reference tasks against one Coordinator,
///         proving the abstraction is protocol-agnostic: liquidation, DEX arb, cron.
contract TasksTest is Test {
    Coordinator internal coord;

    uint96 internal constant BOND = 1 ether;
    uint32 internal constant WINDOW = 5;

    address internal operator = makeAddr("operator");
    address internal alice = makeAddr("alice");

    function setUp() public {
        coord = new Coordinator();
        vm.deal(operator, 100 ether);
    }

    function _subject(address a) internal pure returns (bytes32) {
        return TaskEncoding.subjectFromAddress(a);
    }

    // ── Task 1: Aave-style liquidation (enforced) ────────────────────────────────

    function test_aave_liquidation_endToEnd() public {
        MockOracle oracle = new MockOracle(1000e18); // collateral price $1000
        EnforcedMockPool pool = new EnforcedMockPool(coord, oracle);
        AaveHealthPredicate pred = new AaveHealthPredicate();

        // Alice: 10 collateral ($10k) vs $7.5k debt. HF = 10*1000*0.85/7500 = 1.133 → safe.
        pool.createPosition(alice, 10e18, 7500e18);

        bytes32 checkParam = bytes32(uint256(uint160(address(pool))));
        bytes32 taskId = coord.registerTask(address(pred), checkParam, WINDOW, BOND, 0);
        pool.setTaskId(taskId); // opt into enforcement

        bytes32 subject = _subject(alice);
        assertFalse(coord.isEligible(taskId, subject), "healthy position should be ineligible");

        // DROP PRICE → HF < 1.
        pool.setCollateralPrice(800e18); // 10*800*0.85/7500 = 0.906
        assertTrue(coord.isEligible(taskId, subject), "unhealthy position should be eligible");

        // Keeper executor races the claim, then executes.
        AaveLiquidationExecutor exec = new AaveLiquidationExecutor(coord, operator, address(pool));
        vm.prank(operator);
        exec.reserve{value: BOND}(taskId, subject);
        assertEq(coord.holder(taskId, subject), address(exec), "executor should hold the claim");

        vm.prank(operator);
        exec.perform(taskId, subject, "");

        (,,,,, uint256 hf) = pool.getUserAccountData(alice);
        assertEq(hf, type(uint256).max, "position not liquidated");
        assertFalse(coord.isEligible(taskId, subject), "predicate should have flipped false");
        assertEq(coord.holder(taskId, subject), address(0), "claim slot not freed");
        assertEq(coord.withdrawable(address(exec)), BOND, "bond not refunded to executor");

        (, uint64 fulfilled,,) = coord.taskStats(taskId);
        assertEq(fulfilled, 1);

        // Executor forwards the reclaimed bond to the operator.
        uint256 before = operator.balance;
        exec.collect();
        assertEq(operator.balance - before, BOND);
    }

    function test_aave_enforcement_blocksNonHolder() public {
        MockOracle oracle = new MockOracle(1000e18);
        EnforcedMockPool pool = new EnforcedMockPool(coord, oracle);
        AaveHealthPredicate pred = new AaveHealthPredicate();
        pool.createPosition(alice, 10e18, 7500e18);
        bytes32 taskId =
            coord.registerTask(address(pred), bytes32(uint256(uint160(address(pool)))), WINDOW, BOND, 0);
        pool.setTaskId(taskId);
        pool.setCollateralPrice(800e18);

        // Nobody holds a claim → the enforced pool rejects a direct liquidation.
        vm.prank(operator);
        vm.expectRevert(ClaimEnforced.NotClaimHolder.selector);
        pool.liquidate(alice);
    }

    function test_aave_grief_isSlashed_selfHeal_isRefunded() public {
        MockOracle oracle = new MockOracle(1000e18);
        EnforcedMockPool pool = new EnforcedMockPool(coord, oracle);
        AaveHealthPredicate pred = new AaveHealthPredicate();
        pool.createPosition(alice, 10e18, 7500e18);
        bytes32 taskId =
            coord.registerTask(address(pred), bytes32(uint256(uint160(address(pool)))), WINDOW, BOND, 0);
        pool.setTaskId(taskId);
        pool.setCollateralPrice(800e18);
        bytes32 subject = _subject(alice);

        // Griefer claims and does nothing while the position stays unhealthy → slash.
        AaveLiquidationExecutor griefer = new AaveLiquidationExecutor(coord, operator, address(pool));
        vm.prank(operator);
        griefer.reserve{value: BOND}(taskId, subject);
        vm.roll(block.number + WINDOW + 1);
        coord.resolve(taskId, subject);
        assertEq(uint8(coord.getClaim(taskId, subject).status), uint8(ICoordinator.ClaimStatus.Slashed));

        // New claim; this time Alice repays before expiry → self-heal → refund.
        AaveLiquidationExecutor honest = new AaveLiquidationExecutor(coord, operator, address(pool));
        vm.prank(operator);
        honest.reserve{value: BOND}(taskId, subject);
        pool.repay(alice, 7500e18); // debt cleared → HF = max → ineligible
        vm.roll(block.number + WINDOW + 1);
        coord.resolve(taskId, subject);
        assertEq(uint8(coord.getClaim(taskId, subject).status), uint8(ICoordinator.ClaimStatus.Released));
        assertEq(coord.withdrawable(address(honest)), BOND, "self-heal bond not refunded");
    }

    // ── Task 2: DEX arbitrage ────────────────────────────────────────────────────

    function test_dexArb_endToEnd() public {
        MockOracle poolPrice = new MockOracle(1000e18);
        MockOracle refOracle = new MockOracle(1000e18);
        PriceDivergencePredicate pred = new PriceDivergencePredicate();

        // 1% threshold; subject = pool price source, checkParam = (bps, oracle).
        bytes32 checkParam = TaskEncoding.packPriceParam(100, address(refOracle));
        bytes32 subject = _subject(address(poolPrice));
        bytes32 taskId = coord.registerTask(address(pred), checkParam, WINDOW, BOND, 0);

        assertFalse(coord.isEligible(taskId, subject), "aligned prices should be ineligible");

        // Pool price diverges 5% above oracle → eligible.
        poolPrice.setPrice(1050e18);
        assertTrue(coord.isEligible(taskId, subject), "divergence should be eligible");

        DexArbExecutor exec = new DexArbExecutor(coord, operator);
        vm.prank(operator);
        exec.reserve{value: BOND}(taskId, subject);

        // Arb corrects the pool price back to the oracle.
        vm.prank(operator);
        exec.perform(taskId, subject, abi.encode(uint256(1000e18)));

        assertEq(poolPrice.price(), 1000e18, "pool price not corrected");
        assertFalse(coord.isEligible(taskId, subject), "predicate should have flipped false");
        assertEq(coord.withdrawable(address(exec)), BOND);
    }

    // ── Task 3: cron / harvest (bounty-funded) ───────────────────────────────────

    function test_harvest_endToEnd_withBounty() public {
        MockVault vault = new MockVault();
        IntervalPredicate pred = new IntervalPredicate();

        uint256 interval = 1 hours;
        uint96 bounty = 0.1 ether;
        bytes32 checkParam = bytes32(interval);
        bytes32 subject = _subject(address(vault));
        bytes32 taskId = coord.registerTask{value: 1 ether}(address(pred), checkParam, WINDOW, BOND, bounty);

        assertFalse(coord.isEligible(taskId, subject), "freshly harvested vault is ineligible");

        // Interval elapses → eligible.
        vm.warp(block.timestamp + interval + 1);
        assertTrue(coord.isEligible(taskId, subject), "elapsed interval should be eligible");

        HarvestExecutor exec = new HarvestExecutor(coord, operator);
        vm.prank(operator);
        exec.reserve{value: BOND}(taskId, subject);
        assertEq(coord.reservedEscrow(taskId), bounty, "bounty not reserved");

        vm.prank(operator);
        exec.perform(taskId, subject, "");

        assertEq(vault.harvestCount(), 1, "vault not harvested");
        assertFalse(coord.isEligible(taskId, subject), "predicate should have flipped false");
        // Bond + bounty both credited to the executor.
        assertEq(coord.withdrawable(address(exec)), BOND + bounty, "bond+bounty not paid");
        assertEq(coord.reservedEscrow(taskId), 0);
    }
}
