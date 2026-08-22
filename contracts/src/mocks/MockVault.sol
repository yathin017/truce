// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IHarvestable} from "../interfaces/IAavePoolLike.sol";

/// @notice A yield vault whose `harvest` is due on a fixed interval. Zero intrinsic MEV —
///         proves that tasks with no arbitrage value coordinate identically, funded from
///         the sponsor's bounty escrow.
contract MockVault is IHarvestable {
    uint256 public lastHarvest;
    uint256 public harvestCount;

    event Harvested(address indexed caller, uint256 timestamp, uint256 count);

    constructor() {
        lastHarvest = block.timestamp;
    }

    function harvest() external {
        lastHarvest = block.timestamp;
        harvestCount++;
        emit Harvested(msg.sender, block.timestamp, harvestCount);
    }
}
