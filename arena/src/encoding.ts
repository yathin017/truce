import { pad, type Address, type Hex } from "viem";

/** subject = bytes32(uint160(address)). */
export function subjectFromAddress(a: Address): Hex {
  return pad(a, { size: 32 });
}

/** Pack (thresholdBps, oracle) for PriceDivergencePredicate: oracle low 160 bits, bps << 160. */
export function packPriceParam(thresholdBps: number, oracle: Address): Hex {
  const packed = (BigInt(oracle) | (BigInt(thresholdBps) << 160n)).toString(16).padStart(64, "0");
  return `0x${packed}` as Hex;
}

/** A uint as bytes32 (for interval checkParam). */
export function uintToBytes32(v: bigint | number): Hex {
  return `0x${BigInt(v).toString(16).padStart(64, "0")}` as Hex;
}
