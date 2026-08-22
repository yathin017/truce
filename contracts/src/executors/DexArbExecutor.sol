// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseExecutor} from "./BaseExecutor.sol";
import {ICoordinator} from "../interfaces/ICoordinator.sol";

interface ISettablePrice {
    function setPrice(uint256 newPrice) external;
}

/// @notice Executor for the DEX-arbitrage task. `_work` "corrects" the pool's spot price
///         toward the oracle (the mock stand-in for executing the arb trade), which flips
///         the divergence predicate false — proving the world changed.
///         `payload` = abi.encode(uint256 correctedPrice).
contract DexArbExecutor is BaseExecutor {
    constructor(ICoordinator _coordinator, address _operator) BaseExecutor(_coordinator, _operator) {}

    function _work(bytes32 subject, bytes calldata payload) internal override {
        address pool = address(uint160(uint256(subject)));
        uint256 correctedPrice = abi.decode(payload, (uint256));
        ISettablePrice(pool).setPrice(correctedPrice);
    }
}
