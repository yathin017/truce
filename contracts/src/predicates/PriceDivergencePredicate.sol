// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEligibilityPredicate} from "../interfaces/IEligibilityPredicate.sol";
import {IPriceSource} from "../interfaces/IAavePoolLike.sol";
import {TaskEncoding} from "../lib/TaskEncoding.sol";

/// @notice Eligible when a pool's spot price diverges from an oracle by more than a
///         threshold — a DEX arbitrage opportunity. A completely different opportunity
///         shape from liquidation, proving the coordinator is not liquidation-specific.
///         `subject`    = pool price source, as bytes32(uint160(pool)).
///         `checkParam` = packed (uint16 thresholdBps, address oracle).
contract PriceDivergencePredicate is IEligibilityPredicate {
    using TaskEncoding for bytes32;

    function isEligible(bytes32 subject, bytes32 checkParam) external view returns (bool) {
        address pool = address(uint160(uint256(subject)));
        (uint16 thresholdBps, address oracle) = TaskEncoding.unpackPriceParam(checkParam);

        uint256 poolPrice = IPriceSource(pool).price();
        uint256 oraclePrice = IPriceSource(oracle).price();
        if (oraclePrice == 0) return false;

        uint256 diff = poolPrice > oraclePrice ? poolPrice - oraclePrice : oraclePrice - poolPrice;
        return diff * 10_000 / oraclePrice > thresholdBps;
    }
}
