// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseExecutor} from "./BaseExecutor.sol";
import {ICoordinator} from "../interfaces/ICoordinator.sol";

interface IArbJob {
    function arb() external;
}

/// @notice Executor for the MockArbPool demo task. `_work` calls the pool's enforced `arb()`,
///         which pulls the price back to the oracle and flips the divergence predicate false.
contract ArbJobExecutor is BaseExecutor {
    constructor(ICoordinator _coordinator, address _operator) BaseExecutor(_coordinator, _operator) {}

    function _work(bytes32 subject, bytes calldata) internal override {
        address pool = address(uint160(uint256(subject)));
        IArbJob(pool).arb();
    }
}
