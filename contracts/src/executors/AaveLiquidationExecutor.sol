// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseExecutor} from "./BaseExecutor.sol";
import {ICoordinator} from "../interfaces/ICoordinator.sol";

interface ILiquidatablePool {
    function liquidate(address user) external;
}

/// @notice Executor for the Aave-style liquidation task. `_work` forwards to the pool's
///         enforced `liquidate`, which itself checks this executor holds the claim.
contract AaveLiquidationExecutor is BaseExecutor {
    address public immutable pool;

    constructor(ICoordinator _coordinator, address _operator, address _pool)
        BaseExecutor(_coordinator, _operator)
    {
        pool = _pool;
    }

    function _work(bytes32 subject, bytes calldata) internal override {
        address user = address(uint160(uint256(subject)));
        ILiquidatablePool(pool).liquidate(user);
    }
}
