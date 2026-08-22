// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IEligibilityPredicate} from "../../src/interfaces/IEligibilityPredicate.sol";

/// @dev A clean, honest predicate: per-subject eligibility flag. Used for lifecycle tests.
contract SubjectFlagPredicate is IEligibilityPredicate {
    mapping(bytes32 => bool) public eligibleOf;

    function setEligible(bytes32 subject, bool v) external {
        eligibleOf[subject] = v;
    }

    function isEligible(bytes32 subject, bytes32) external view returns (bool) {
        return eligibleOf[subject];
    }
}

/// @dev Always eligible — models the malicious "always-true" bond-farm predicate.
contract AlwaysTruePredicate is IEligibilityPredicate {
    function isEligible(bytes32, bytes32) external pure returns (bool) {
        return true;
    }
}

/// @dev Never eligible.
contract AlwaysFalsePredicate is IEligibilityPredicate {
    function isEligible(bytes32, bytes32) external pure returns (bool) {
        return false;
    }
}

/// @dev A predicate whose behaviour the (malicious) sponsor can switch at will, to
///      exercise every fail-closed path. `isEligible` is intentionally NOT `view` so
///      the Mutate mode can attempt an SSTORE — which the coordinator's `staticcall`
///      must block.
contract MutablePredicate {
    enum Mode {
        Normal,
        Revert,
        GasBomb,
        Garbage,
        Mutate
    }

    Mode public mode;
    mapping(bytes32 => bool) public eligibleOf;
    bytes32 public lastMutated; // must stay zero: proof staticcall blocked mutation

    function setMode(Mode m) external {
        mode = m;
    }

    function setEligible(bytes32 subject, bool v) external {
        eligibleOf[subject] = v;
    }

    function isEligible(bytes32 subject, bytes32) external returns (bool) {
        Mode m = mode;
        if (m == Mode.Revert) {
            revert("malicious revert");
        }
        if (m == Mode.GasBomb) {
            uint256 x = uint256(subject);
            for (uint256 i; i < type(uint256).max; ++i) {
                unchecked {
                    x = uint256(keccak256(abi.encode(x)));
                }
            }
            return x != 0;
        }
        if (m == Mode.Garbage) {
            // Return 64 bytes instead of 32 to try to confuse decoding.
            assembly {
                mstore(0x00, 1)
                mstore(0x20, 1)
                return(0x00, 0x40)
            }
        }
        if (m == Mode.Mutate) {
            lastMutated = subject; // SSTORE — reverts under staticcall
            return true;
        }
        return eligibleOf[subject];
    }
}
