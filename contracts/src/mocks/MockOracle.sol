// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IPriceSource} from "../interfaces/IAavePoolLike.sol";

/// @notice A settable 1e18-scaled price source. Doubles as a collateral price feed
///         (for the lending pool) and as a pool/oracle spot source (for DEX arb).
///         `setPrice` is intentionally open — this is a demo device.
contract MockOracle is IPriceSource {
    uint256 public price;

    event PriceUpdated(uint256 price);

    constructor(uint256 initialPrice) {
        price = initialPrice;
    }

    function setPrice(uint256 newPrice) external {
        price = newPrice;
        emit PriceUpdated(newPrice);
    }
}
