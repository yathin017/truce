// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICoordinator} from "../interfaces/ICoordinator.sol";

/// @title BaseExecutor
/// @notice The template a keeper extends to write ~10 lines of real logic. The keeper's
///         executor — not the coordinator — performs the work, so funds and `msg.sender`
///         stay with the keeper. Genericity and safety both come from the coordinator
///         never touching the work.
/// @dev    Ordering: `reserve` races the cheap claim (claim holder = this executor);
///         `perform` gates on holding the live claim, does the work while the claim is
///         still active (so an enforcing protocol's `holder(...) == msg.sender` check
///         passes), then settles via `consume` to reclaim the bond and any bounty.
abstract contract BaseExecutor {
    ICoordinator public immutable coordinator;
    address public immutable operator;

    error NotOperator();
    error NotHolder();
    error ForwardFailed();

    constructor(ICoordinator _coordinator, address _operator) {
        coordinator = _coordinator;
        operator = _operator;
    }

    /// @notice Race the cheap bonded claim. Declare a tight gas limit when calling this —
    ///         on Monad the declared limit is what you pay.
    function reserve(bytes32 taskId, bytes32 subject) external payable returns (bytes32 claimId) {
        if (msg.sender != operator) revert NotOperator();
        return coordinator.claim{value: msg.value}(taskId, subject);
    }

    /// @notice Execute after winning the claim: assert exclusivity, do the work, settle.
    function perform(bytes32 taskId, bytes32 subject, bytes calldata payload) external {
        if (msg.sender != operator) revert NotOperator();
        if (coordinator.holder(taskId, subject) != address(this)) revert NotHolder();
        _work(subject, payload);
        coordinator.consume(taskId, subject);
    }

    /// @notice Pull refunded bond + earned bounty out of the coordinator to the operator.
    function collect() external {
        coordinator.withdraw();
        uint256 bal = address(this).balance;
        if (bal > 0) {
            (bool ok,) = operator.call{value: bal}("");
            if (!ok) revert ForwardFailed();
        }
    }

    receive() external payable {}

    /// @dev Keeper's own logic. Funds stay in this contract.
    function _work(bytes32 subject, bytes calldata payload) internal virtual;
}
