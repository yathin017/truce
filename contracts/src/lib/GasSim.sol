// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Consumes a target amount of gas so a mock action costs like the real thing.
///         A real liquidation (flash loan + swap + seize) or arbitrage burns hundreds of
///         thousands of gas; the mocks are otherwise trivial, which would make the cheap
///         claim look expensive by comparison. This makes the demo faithful — and because
///         it targets *consumed* gas (not a fixed iteration count) it costs the same on any
///         chain, so `eth_estimateGas` returns a realistic, stable number.
library GasSim {
    /// @dev Spin until `target` gas has been consumed since entry. The caller must store the
    ///      returned value so the optimizer cannot elide the loop.
    function spin(uint256 target, uint256 seed) internal view returns (uint256 x) {
        uint256 start = gasleft();
        x = seed;
        unchecked {
            while (start - gasleft() < target) {
                x = uint256(keccak256(abi.encode(x)));
            }
        }
    }
}
