/**
 * Subject / checkParam encoding — mirrors `contracts/src/lib/TaskEncoding.sol`.
 *
 * Both are a single 32-byte word by design: `claim()` must stay cheap, and a
 * cheap claim is the entire thesis on Monad.
 */

import type { Address, Hex } from "@/types/truce";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as Address;

export function isAddress(value: string): value is Address {
  return /^0x[0-9a-fA-F]{40}$/.test(value);
}

export function isBytes32(value: string): value is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(value);
}

/** TaskEncoding.subjectFromAddress — bytes32(uint256(uint160(a))). */
export function subjectFromAddress(address: string): Hex {
  const body = address.replace(/^0x/, "").toLowerCase();
  return `0x${body.padStart(64, "0")}` as Hex;
}

/** TaskEncoding.addressFromSubject. */
export function addressFromSubject(subject: string): Address {
  return `0x${subject.replace(/^0x/, "").slice(-40)}` as Address;
}

/**
 * TaskEncoding.packPriceParam — oracle in the low 160 bits, thresholdBps in
 * the next 16. Used by PriceDivergencePredicate.
 */
export function packPriceParam(thresholdBps: number, oracle: string): Hex {
  const packed =
    (BigInt(thresholdBps) << 160n) | BigInt(oracle as `0x${string}`);
  return `0x${packed.toString(16).padStart(64, "0")}` as Hex;
}

export function unpackPriceParam(checkParam: string): {
  thresholdBps: number;
  oracle: Address;
} {
  const cp = BigInt(checkParam as `0x${string}`);
  return {
    oracle: `0x${(cp & ((1n << 160n) - 1n)).toString(16).padStart(40, "0")}` as Address,
    thresholdBps: Number((cp >> 160n) & 0xffffn),
  };
}

/** IntervalPredicate — checkParam is simply the interval in seconds. */
export function packIntervalParam(seconds: number): Hex {
  return `0x${BigInt(seconds).toString(16).padStart(64, "0")}` as Hex;
}

export function unpackIntervalParam(checkParam: string): number {
  return Number(BigInt(checkParam as `0x${string}`));
}

/** Human-readable decoding of a checkParam for a given predicate shape. */
export function describeCheckParam(
  shape: "address" | "price" | "interval",
  checkParam: string,
): string {
  switch (shape) {
    case "address":
      return addressFromSubject(checkParam);
    case "price": {
      const { thresholdBps, oracle } = unpackPriceParam(checkParam);
      return `${thresholdBps} bps vs ${oracle}`;
    }
    case "interval": {
      const s = unpackIntervalParam(checkParam);
      return s % 3600 === 0 ? `${s / 3600}h interval` : `${s}s interval`;
    }
  }
}
