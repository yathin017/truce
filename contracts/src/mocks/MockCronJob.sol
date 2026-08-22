// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICoordinator} from "../interfaces/ICoordinator.sol";
import {IHarvestable} from "../interfaces/IAavePoolLike.sol";
import {ClaimEnforced} from "./ClaimEnforced.sol";
import {GasSim} from "../lib/GasSim.sol";

/// @notice A demo upkeep job that becomes due every `interval` seconds. `harvest()` is the
///         expensive, once-per-interval action: it reverts until the interval has elapsed —
///         so in a naive race only the first lands and the rest revert, each still billed
///         its full declared gas limit on Monad. Zero intrinsic MEV: this proves tasks with
///         no arbitrage value coordinate identically.
/// @dev    Subject for the predicate and the claim gate is this job's own address.
contract MockCronJob is ClaimEnforced, IHarvestable {
    /// @notice Gas a real upkeep (compound / rebalance) would burn — consumed on the success
    ///         path so the mock is a faithful, dynamically-estimable stand-in. Lighter than a
    ///         liquidation, as upkeeps usually are.
    uint256 public constant WORK_GAS = 180_000;

    uint256 public interval;
    uint256 public lastHarvest;
    uint256 public harvestCount;
    uint256 private _gasSink;

    event Harvested(address indexed caller, uint256 timestamp, uint256 count);
    event PushedDue();

    constructor(ICoordinator _coordinator, uint256 _interval) ClaimEnforced(_coordinator) {
        interval = _interval;
        lastHarvest = block.timestamp;
    }

    function subject() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    /// @notice Reset/refill: mark the job due again by backdating its last run. Makes
    ///         eligibility a deterministic state flip (not wall-clock dependent), so a
    ///         naive race produces clean losers even across Monad's multi-block inclusion.
    function refill() external {
        lastHarvest = 0;
        emit PushedDue();
    }

    function due() public view returns (bool) {
        return block.timestamp > lastHarvest + interval;
    }

    /// @notice The expensive action, enforced + once-per-interval.
    function harvest() external onlyHolder(subject()) {
        require(due(), "not due");
        _gasSink = GasSim.spin(WORK_GAS, _gasSink);
        lastHarvest = block.timestamp;
        harvestCount++;
        emit Harvested(msg.sender, block.timestamp, harvestCount);
    }
}
