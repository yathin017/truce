import type { Abi, Account, Address, PublicClient } from "viem";
import { claimGasLimit } from "@truce/shared";
import type { TxRole } from "./types.js";

/**
 * Declared-limit policy. Gas limits are derived from a live `eth_estimateGas` on the actual
 * call, then padded per bot — never a hardcoded constant.
 *
 * Real keepers don't all declare the same limit: each pads its estimate by a different safety
 * margin. We model that with a stable per-bot "personality" factor plus a little per-round
 * jitter, so every row on the UI shows a distinct, realistic gas figure while staying safely
 * above the out-of-gas floor.
 */

/** Stable per-bot padding personalities (added to the base factor). Bot 0 pads tightest. */
const BOT_SPREAD = [0.0, 0.16, 0.08, 0.24];

/** Per-round headroom factor for bot `i`: base + its personality + small jitter. */
export function botFactor(base: number, i: number): number {
  const spread = BOT_SPREAD[i % BOT_SPREAD.length] ?? 0;
  const jitter = (Math.random() - 0.5) * 0.06; // ±3%
  return Math.max(1.02, base + spread + jitter);
}

/**
 * Minimum declared limit per role, so an estimate under-shoot never causes an out-of-gas.
 * The expensive-work floor is kept well above the claim floor: if `eth_estimateGas` fails and
 * both sides fall back to floors, the expensive work must still read as expensive, or the
 * naive-vs-coordinated comparison could invert (a real liquidation success path is ~400–600k).
 */
export function floorFor(role: TxRole, chainId: number): bigint {
  switch (role) {
    case "claim":
      return claimGasLimit(chainId); // chain-aware: 200k Monad, 130k anvil
    case "execute":
    case "liquidate":
    case "arb":
    case "harvest":
      return chainId === 10143 ? 420_000n : 320_000n;
    default:
      return 320_000n;
  }
}

/** Apply a bot's factor to a raw estimate, round up for legibility, enforce the floor. */
export function declaredFromRaw(rawEstimate: bigint, factor: number, floor: bigint): bigint {
  const padded = (rawEstimate * BigInt(Math.round(factor * 1000))) / 1000n;
  const rounded = ((padded + 999n) / 1000n) * 1000n; // round up to the nearest 1k
  return rounded > floor ? rounded : floor;
}

export interface EstimateArgs {
  publicClient: PublicClient;
  account: Account;
  address: Address;
  abi: Abi;
  functionName: string;
  args: readonly unknown[];
  value?: bigint;
}

/** Raw `eth_estimateGas` for a call (no padding). Falls back to the role floor if it throws. */
export async function estimateRaw(role: TxRole, chainId: number, a: EstimateArgs): Promise<bigint> {
  try {
    return (await a.publicClient.estimateContractGas({
      address: a.address,
      abi: a.abi,
      functionName: a.functionName,
      args: a.args,
      account: a.account,
      ...(a.value !== undefined ? { value: a.value } : {}),
    } as never)) as bigint;
  } catch {
    return floorFor(role, chainId); // estimation unavailable → safe baseline
  }
}

/** One raw estimate, padded into a distinct declared limit for each of `count` bots. */
export function perBotLimits(rawEstimate: bigint, role: TxRole, chainId: number, base: number, count: number): bigint[] {
  const floor = floorFor(role, chainId);
  return Array.from({ length: count }, (_, i) => declaredFromRaw(rawEstimate, botFactor(base, i), floor));
}
