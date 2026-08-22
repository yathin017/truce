// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICoordinator} from "../interfaces/ICoordinator.sol";
import {IPriceSource} from "../interfaces/IAavePoolLike.sol";
import {MockOracle} from "./MockOracle.sol";
import {ClaimEnforced} from "./ClaimEnforced.sol";

/// @notice A demo AMM pool whose spot price can drift off the oracle peg. `arb()` is the
///         expensive, once-until-reset action: it pulls the price back to the oracle and
///         reverts if there is nothing to arb — so in a naive race the losers revert while
///         still being billed their full declared gas limit on Monad.
/// @dev    The subject for both the eligibility predicate and the claim gate is this pool's
///         own address, encoded as bytes32(uint160(address(this))).
contract MockArbPool is ClaimEnforced, IPriceSource {
    MockOracle public immutable oracle;
    uint16 public immutable thresholdBps;
    uint256 public price;

    event PushedOffPeg(uint256 price);
    event Arbed(address indexed caller, uint256 price);

    constructor(ICoordinator _coordinator, MockOracle _oracle, uint16 _thresholdBps)
        ClaimEnforced(_coordinator)
    {
        oracle = _oracle;
        thresholdBps = _thresholdBps;
        price = _oracle.price();
    }

    function subject() public view returns (bytes32) {
        return bytes32(uint256(uint160(address(this))));
    }

    /// @notice Reset/refill: drift the pool price off the oracle peg so an arb is available.
    function pushOffPeg(uint256 newPrice) external {
        price = newPrice;
        emit PushedOffPeg(newPrice);
    }

    function diverged() public view returns (bool) {
        uint256 op = oracle.price();
        if (op == 0) return false;
        uint256 d = price > op ? price - op : op - price;
        return d * 10_000 / op > thresholdBps;
    }

    /// @notice The expensive action, enforced + once-until-reset.
    function arb() external onlyHolder(subject()) {
        require(diverged(), "pegged");
        price = oracle.price();
        emit Arbed(msg.sender, price);
    }
}
