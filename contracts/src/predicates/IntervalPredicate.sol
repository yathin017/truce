// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEligibilityPredicate} from "../interfaces/IEligibilityPredicate.sol";
import {IHarvestable} from "../interfaces/IAavePoolLike.sol";

/// @notice Eligible when a target's interval has elapsed since its last run — a cron /
///         harvest upkeep with zero intrinsic MEV.
///         `subject`    = target, as bytes32(uint160(target)).
///         `checkParam` = interval in seconds.
contract IntervalPredicate is IEligibilityPredicate {
    function isEligible(bytes32 subject, bytes32 checkParam) external view returns (bool) {
        address target = address(uint160(uint256(subject)));
        uint256 interval = uint256(checkParam);
        return block.timestamp > IHarvestable(target).lastHarvest() + interval;
    }
}
