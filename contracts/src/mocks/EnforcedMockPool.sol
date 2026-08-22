// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICoordinator} from "../interfaces/ICoordinator.sol";
import {IAavePoolLike} from "../interfaces/IAavePoolLike.sol";
import {MockOracle} from "./MockOracle.sol";
import {ClaimEnforced} from "./ClaimEnforced.sol";

/// @notice A minimal, Aave-V3-compatible lending market used as the honest demo device.
///         `liquidate` is the expensive path, gated on the caller holding a live claim —
///         i.e. what a production protocol integration looks like. Labelled a MOCK in the
///         UI; it is not a real Aave deployment.
contract EnforcedMockPool is ClaimEnforced, IAavePoolLike {
    /// @notice 1e18-scaled liquidation threshold (85%).
    uint256 public constant LIQUIDATION_THRESHOLD = 0.85e18;
    uint256 internal constant WAD = 1e18;

    MockOracle public immutable oracle;

    struct Position {
        uint256 collateral; // collateral token amount (1e18)
        uint256 debt; // debt in base units (1e18)
        bool liquidated;
    }

    mapping(address user => Position) public positions;

    event PositionCreated(address indexed user, uint256 collateral, uint256 debt);
    event PositionLiquidated(address indexed user, address indexed liquidator);
    event Repaid(address indexed user, uint256 amount);

    constructor(ICoordinator _coordinator, MockOracle _oracle) ClaimEnforced(_coordinator) {
        oracle = _oracle;
    }

    // ── demo controls ───────────────────────────────────────────────────────────

    function createPosition(address user, uint256 collateral, uint256 debt) external {
        positions[user] = Position({collateral: collateral, debt: debt, liquidated: false});
        emit PositionCreated(user, collateral, debt);
    }

    /// @notice The "DROP PRICE" button — crashes collateral price to push HF < 1.
    function setCollateralPrice(uint256 newPrice) external {
        oracle.setPrice(newPrice);
    }

    /// @notice Borrower repays — models the self-heal edge case (opportunity evaporates).
    function repay(address user, uint256 amount) external {
        Position storage p = positions[user];
        p.debt = amount >= p.debt ? 0 : p.debt - amount;
        emit Repaid(user, amount);
    }

    // ── views ─────────────────────────────────────────────────────────────────────

    function collateralValue(address user) public view returns (uint256) {
        return positions[user].collateral * oracle.price() / WAD;
    }

    function healthFactor(address user) public view returns (uint256) {
        Position storage p = positions[user];
        if (p.liquidated || p.debt == 0) return type(uint256).max;
        return collateralValue(user) * LIQUIDATION_THRESHOLD / p.debt;
    }

    function isLiquidatable(address user) public view returns (bool) {
        return healthFactor(user) < WAD;
    }

    /// @inheritdoc IAavePoolLike
    function getUserAccountData(address user)
        external
        view
        returns (uint256, uint256, uint256, uint256, uint256, uint256)
    {
        Position storage p = positions[user];
        return (collateralValue(user), p.debt, 0, LIQUIDATION_THRESHOLD, 0, healthFactor(user));
    }

    // ── expensive path (enforced) ───────────────────────────────────────────────

    /// @notice Liquidate `user`. Enforced: only the current claim holder may call.
    ///         `subject == bytes32(uint160(user))`.
    function liquidate(address user) external onlyHolder(bytes32(uint256(uint160(user)))) {
        Position storage p = positions[user];
        require(!p.liquidated, "already liquidated");
        require(healthFactor(user) < WAD, "position healthy");
        p.liquidated = true;
        emit PositionLiquidated(user, msg.sender);
    }
}
