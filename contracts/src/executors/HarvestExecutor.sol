// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseExecutor} from "./BaseExecutor.sol";
import {ICoordinator} from "../interfaces/ICoordinator.sol";

interface IHarvestTarget {
    function harvest() external;
}

/// @notice Executor for the cron/harvest task. `_work` calls the target's `harvest`,
///         which resets its `lastHarvest` and flips the interval predicate false.
contract HarvestExecutor is BaseExecutor {
    constructor(ICoordinator _coordinator, address _operator) BaseExecutor(_coordinator, _operator) {}

    function _work(bytes32 subject, bytes calldata) internal override {
        address target = address(uint160(uint256(subject)));
        IHarvestTarget(target).harvest();
    }
}
