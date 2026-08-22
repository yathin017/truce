// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";

import {EnforcedMockPool} from "../src/mocks/EnforcedMockPool.sol";

/// @notice Re-seed the demo between experiment runs: reads the deployment JSON written by
///         Deploy.s.sol and resets the demo position to a healthy state (HF > 1) so the
///         "DROP PRICE" step is reproducible. Tasks themselves are registered by Deploy;
///         this script exists to reset state without redeploying.
contract RegisterTasks is Script {
    address internal constant DEMO_USER = 0x00000000000000000000000000000000000A11cE;

    function run() external {
        string memory path =
            string.concat("../packages/shared/deployments/", vm.toString(block.chainid), ".json");
        string memory json = vm.readFile(path);

        address pool = vm.parseJsonAddress(json, ".mockPool");
        address poolPrice = vm.parseJsonAddress(json, ".poolPriceSource");

        uint256 pk = vm.envOr("DEPLOYER_PRIVATE_KEY", uint256(0));
        if (pk != 0) vm.startBroadcast(pk);
        else vm.startBroadcast();

        // Reset the lending position to healthy and restore collateral price.
        EnforcedMockPool(pool).setCollateralPrice(1000e18);
        EnforcedMockPool(pool).createPosition(DEMO_USER, 10e18, 7500e18);

        // Restore the arb pool price to parity (settable mock oracle).
        (bool ok,) = poolPrice.call(abi.encodeWithSignature("setPrice(uint256)", uint256(1000e18)));
        require(ok, "reset pool price failed");

        vm.stopBroadcast();
        console2.log("Demo state reset for chainId", block.chainid);
    }
}
