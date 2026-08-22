// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {Coordinator} from "../src/Coordinator.sol";
import {TaskEncoding} from "../src/lib/TaskEncoding.sol";

import {MockOracle} from "../src/mocks/MockOracle.sol";
import {EnforcedMockPool} from "../src/mocks/EnforcedMockPool.sol";
import {MockVault} from "../src/mocks/MockVault.sol";

import {AaveHealthPredicate} from "../src/predicates/AaveHealthPredicate.sol";
import {PriceDivergencePredicate} from "../src/predicates/PriceDivergencePredicate.sol";
import {IntervalPredicate} from "../src/predicates/IntervalPredicate.sol";

/// @notice Deploys the Coordinator, demo mocks, and the three predicates, registers the
///         three reference tasks, seeds a demo position, and writes the deployment to
///         `packages/shared/deployments/<chainId>.json` for the TS packages to consume.
/// @dev    Deployed contracts are held in storage to keep `run()` under the stack limit.
contract Deploy is Script {
    uint32 internal constant WINDOW = 3; // ~ a few Monad blocks
    uint96 internal constant BOND = 0.01 ether;
    uint16 internal constant ARB_THRESHOLD_BPS = 100; // 1%
    uint256 internal constant HARVEST_INTERVAL = 1 hours;
    address internal constant DEMO_USER = 0x00000000000000000000000000000000000A11cE;

    Coordinator internal coord;
    MockOracle internal collateralOracle;
    EnforcedMockPool internal pool;
    MockOracle internal poolPrice;
    MockOracle internal refOracle;
    MockVault internal vault;
    AaveHealthPredicate internal aavePred;
    PriceDivergencePredicate internal arbPred;
    IntervalPredicate internal cronPred;

    bytes32 internal aaveTaskId;
    bytes32 internal arbTaskId;
    bytes32 internal cronTaskId;

    function run() external {
        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();

        coord = new Coordinator();

        // Task 1: Aave-style liquidation.
        collateralOracle = new MockOracle(1000e18);
        pool = new EnforcedMockPool(coord, collateralOracle);
        aavePred = new AaveHealthPredicate();
        pool.createPosition(DEMO_USER, 10e18, 7500e18); // HF ~1.13 at $1000
        aaveTaskId =
            coord.registerTask(address(aavePred), bytes32(uint256(uint160(address(pool)))), WINDOW, BOND, 0);
        pool.setTaskId(aaveTaskId);

        // Task 2: DEX arbitrage.
        poolPrice = new MockOracle(1000e18);
        refOracle = new MockOracle(1000e18);
        arbPred = new PriceDivergencePredicate();
        arbTaskId = coord.registerTask(
            address(arbPred),
            TaskEncoding.packPriceParam(ARB_THRESHOLD_BPS, address(refOracle)),
            WINDOW,
            BOND,
            0
        );

        // Task 3: cron / harvest (bounty-funded).
        vault = new MockVault();
        cronPred = new IntervalPredicate();
        cronTaskId = coord.registerTask{value: 1 ether}(
            address(cronPred), bytes32(HARVEST_INTERVAL), WINDOW, BOND, 0.05 ether
        );

        vm.stopBroadcast();

        _writeDeployment();

        console2.log("Coordinator:", address(coord));
        console2.log("EnforcedMockPool:", address(pool));
        console2.log("MockVault:", address(vault));
    }

    function _writeDeployment() internal {
        string memory aave = "aave";
        vm.serializeBytes32(aave, "taskId", aaveTaskId);
        vm.serializeAddress(aave, "predicate", address(aavePred));
        string memory aaveJson = vm.serializeString(aave, "label", "Aave liquidation");

        string memory arb = "arb";
        vm.serializeBytes32(arb, "taskId", arbTaskId);
        vm.serializeAddress(arb, "predicate", address(arbPred));
        string memory arbJson = vm.serializeString(arb, "label", "DEX arbitrage");

        string memory cron = "cron";
        vm.serializeBytes32(cron, "taskId", cronTaskId);
        vm.serializeAddress(cron, "predicate", address(cronPred));
        string memory cronJson = vm.serializeString(cron, "label", "Cron / harvest");

        string memory tasks = "tasks";
        vm.serializeString(tasks, "aave", aaveJson);
        vm.serializeString(tasks, "arb", arbJson);
        string memory tasksJson = vm.serializeString(tasks, "cron", cronJson);

        string memory root = "root";
        vm.serializeUint(root, "chainId", block.chainid);
        vm.serializeAddress(root, "coordinator", address(coord));
        vm.serializeAddress(root, "mockPool", address(pool));
        vm.serializeAddress(root, "collateralOracle", address(collateralOracle));
        vm.serializeAddress(root, "poolPriceSource", address(poolPrice));
        vm.serializeAddress(root, "refOracle", address(refOracle));
        vm.serializeAddress(root, "mockVault", address(vault));
        string memory out = vm.serializeString(root, "tasks", tasksJson);

        string memory path =
            string.concat("../packages/shared/deployments/", vm.toString(block.chainid), ".json");
        vm.writeJson(out, path);
        console2.log("Deployment written:", path);
    }
}
