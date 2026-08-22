import type { Abi, Account, Address, PublicClient } from "viem";
import { claimGasLimit } from "@reservoir/shared";
import type { TxRole } from "./types.js";

/**
 * Declared-limit policy. Every declared gas limit in the arena is derived from a live
 * `eth_estimateGas` on the actual call, times a headroom factor, rounded up — never a
 * hardcoded constant. A per-role floor guards two cases: (1) `eth_estimateGas` throwing
 * (Monad occasionally errors on simulation), and (2) Monad's live metering running above
 * a node's estimate for cold-storage-heavy paths (a claim estimates ~113k but needs ~200k
 * on testnet), so the floor keeps a winning tx from running out of gas.
 */

/** Minimum declared limit per role, so estimate-under-shoot never causes an out-of-gas. */
function floorFor(role: TxRole, chainId: number): bigint {
  switch (role) {
    case "claim":
      return claimGasLimit(chainId); // chain-aware: 200k Monad, 130k anvil
    case "execute":
    case "liquidate":
    case "arb":
    case "harvest":
      return chainId === 10143 ? 260_000n : 150_000n;
    default:
      return 150_000n;
  }
}

function padAndRound(estimate: bigint, factor: number): bigint {
  const padded = (estimate * BigInt(Math.round(factor * 1000))) / 1000n;
  return ((padded + 999n) / 1000n) * 1000n; // round up to the nearest 1k for legibility
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

/** Estimate a call's gas, apply the headroom factor, and enforce the role floor. */
export async function estimateDeclared(
  role: TxRole,
  chainId: number,
  factor: number,
  { publicClient, account, address, abi, functionName, args, value }: EstimateArgs,
): Promise<bigint> {
  const floor = floorFor(role, chainId);
  try {
    const est = await publicClient.estimateContractGas({
      address,
      abi,
      functionName,
      args,
      account,
      ...(value !== undefined ? { value } : {}),
    } as never);
    const declared = padAndRound(est, factor);
    return declared > floor ? declared : floor;
  } catch {
    return floor; // estimation unavailable → fall back to the safe floor
  }
}
