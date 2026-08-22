// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Helpers for encoding a task's `subject` and `checkParam` into single words.
///         `checkParam` is intentionally one word so `claim()` stays cheap.
library TaskEncoding {
    /// @dev Encode an address (position owner, pool, vault) as a subject.
    function subjectFromAddress(address a) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(a)));
    }

    function addressFromSubject(bytes32 s) internal pure returns (address) {
        return address(uint160(uint256(s)));
    }

    /// @dev Pack (thresholdBps, oracle) for the DEX-arbitrage predicate:
    ///      oracle in the low 160 bits, threshold in the next 16.
    function packPriceParam(uint16 thresholdBps, address oracle) internal pure returns (bytes32) {
        return bytes32(uint256(uint160(oracle)) | (uint256(thresholdBps) << 160));
    }

    function unpackPriceParam(bytes32 checkParam)
        internal
        pure
        returns (uint16 thresholdBps, address oracle)
    {
        uint256 cp = uint256(checkParam);
        oracle = address(uint160(cp));
        thresholdBps = uint16(cp >> 160);
    }
}
