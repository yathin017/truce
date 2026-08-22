// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ICoordinator} from "../interfaces/ICoordinator.sol";

/// @notice Shared enforcement base for demo protocols. Demonstrates the one-line
///         integration that turns keeper-side coordination into protocol-enforced
///         exclusivity: an action is gated on the caller holding a live claim.
/// @dev    `taskId == 0` means voluntary mode (no enforcement), so a protocol can be
///         deployed before its task is registered and opted in afterward.
abstract contract ClaimEnforced {
    ICoordinator public immutable coordinator;
    address public immutable admin;
    bytes32 public taskId;

    error NotAdmin();
    error TaskIdAlreadySet();
    error NotClaimHolder();

    constructor(ICoordinator _coordinator) {
        coordinator = _coordinator;
        admin = msg.sender;
    }

    /// @notice Opt this protocol into enforcement for a registered task (one-time).
    function setTaskId(bytes32 _taskId) external {
        if (msg.sender != admin) revert NotAdmin();
        if (taskId != 0) revert TaskIdAlreadySet();
        taskId = _taskId;
    }

    /// @dev The one line: only the current claim holder may act on `subject`.
    modifier onlyHolder(bytes32 subject) {
        bytes32 tid = taskId;
        if (tid != 0 && coordinator.holder(tid, subject) != msg.sender) revert NotClaimHolder();
        _;
    }
}
