// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEligibilityPredicate} from "../interfaces/IEligibilityPredicate.sol";
import {IAavePoolLike} from "../interfaces/IAavePoolLike.sol";

/// @notice Eligible when a lending position is under water (health factor < 1e18).
///         `subject`    = position owner, as bytes32(uint160(user)).
///         `checkParam` = pool address, as bytes32(uint160(pool)).
/// @dev    Reads the Aave-V3-compatible `getUserAccountData`, so this works against a
///         live Aave deployment or the local EnforcedMockPool unchanged.
contract AaveHealthPredicate is IEligibilityPredicate {
    uint256 internal constant WAD = 1e18;

    function isEligible(bytes32 subject, bytes32 checkParam) external view returns (bool) {
        address user = address(uint160(uint256(subject)));
        address pool = address(uint160(uint256(checkParam)));
        (,,,,, uint256 hf) = IAavePoolLike(pool).getUserAccountData(user);
        return hf < WAD;
    }
}
