// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Minimal Aave V3 pool surface used by the liquidation predicate. The real
///         Aave V3 `Pool.getUserAccountData` returns exactly this tuple, so the same
///         predicate reads a live Aave deployment and the local `EnforcedMockPool`.
interface IAavePoolLike {
    function getUserAccountData(address user)
        external
        view
        returns (
            uint256 totalCollateralBase,
            uint256 totalDebtBase,
            uint256 availableBorrowsBase,
            uint256 currentLiquidationThreshold,
            uint256 ltv,
            uint256 healthFactor
        );
}

/// @notice Common spot-price surface for the DEX-arbitrage predicate.
interface IPriceSource {
    function price() external view returns (uint256);
}

/// @notice Common surface for the interval/harvest predicate.
interface IHarvestable {
    function lastHarvest() external view returns (uint256);
}
