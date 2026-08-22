// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IEligibilityPredicate
/// @notice A task-specific oracle answering: "is `subject` a live, actionable
///         opportunity right now?" The Coordinator calls this via a gas-capped
///         staticcall, so implementations MUST be `view` and MUST NOT revert on
///         normal input — a revert or malformed return is treated as *ineligible*.
interface IEligibilityPredicate {
    /// @param subject    opaque identifier — a position, pool, vault, etc.
    /// @param checkParam task-level configuration fixed at registration (one word).
    /// @return eligible  true iff `subject` is actionable at the current block.
    function isEligible(bytes32 subject, bytes32 checkParam) external view returns (bool eligible);
}
