/**
 * Chains, deployment resolution and the constants that are **fixed by the
 * contracts**. Everything in the CONTRACT block below is mirrored from
 * `contracts/src/Coordinator.sol` — change it there, change it here.
 */

import type { Address, Hex } from "@/types/truce";

/* ------------------------------------------------------------------ */
/* CONTRACT constants — mirrored from Coordinator.sol                  */
/* ------------------------------------------------------------------ */

/** Coordinator.PREDICATE_GAS_CAP — hard cap on the staticcall to isEligible. */
export const PREDICATE_GAS_CAP = 50_000;

/** Coordinator.SLASH_REWARD — fixed, so slashing is never profitable at scale. */
export const SLASH_REWARD_WEI = 2_000_000_000_000_000n; // 0.002 MON

/** Deploy.s.sol defaults, shown as suggestions on the register screen. */
export const DEFAULT_WINDOW_BLOCKS = 3;
export const DEFAULT_BOND_WEI = 10_000_000_000_000_000n; // 0.01 MON

/** experiment/src/rounds.ts — the declared limits the experiment actually uses. */
export const CLAIM_GAS_LIMIT = 130_000;
export const PERFORM_GAS_LIMIT = 500_000;

/* ------------------------------------------------------------------ */
/* Chains                                                              */
/* ------------------------------------------------------------------ */

export interface ChainInfo {
  id: number;
  name: string;
  key: "monadTestnet" | "anvil";
  rpcUrl: string;
  explorerUrl: string;
  /** Nominal block time. Windows are declared in blocks; humans read ms. */
  blockMs: number;
  nativeSymbol: string;
}

export const MONAD_TESTNET: ChainInfo = {
  id: 10_143,
  name: "Monad Testnet",
  key: "monadTestnet",
  rpcUrl: "https://testnet-rpc.monad.xyz",
  explorerUrl: "https://testnet.monadexplorer.com",
  blockMs: 400,
  nativeSymbol: "MON",
};

export const ANVIL: ChainInfo = {
  id: 31_337,
  name: "Anvil",
  key: "anvil",
  rpcUrl: "http://127.0.0.1:8545",
  explorerUrl: "",
  blockMs: 400,
  nativeSymbol: "ETH",
};

export const CHAINS: ChainInfo[] = [MONAD_TESTNET, ANVIL];

export function getChain(chainId: number): ChainInfo {
  return CHAINS.find((c) => c.id === chainId) ?? MONAD_TESTNET;
}

export function explorerAddress(chain: ChainInfo, address: string): string {
  return chain.explorerUrl ? `${chain.explorerUrl}/address/${address}` : "";
}

export function explorerTx(chain: ChainInfo, hash: string): string {
  return chain.explorerUrl ? `${chain.explorerUrl}/tx/${hash}` : "";
}

/* ------------------------------------------------------------------ */
/* Deployment                                                          */
/* ------------------------------------------------------------------ */

/** Mirrors `Deployment` in packages/shared/src/addresses.ts. */
export interface TaskDeployment {
  taskId: Hex;
  predicate: Address;
  executor?: Address;
  label: string;
}

export interface Deployment {
  chainId: number;
  coordinator: Address;
  mockPool?: Address;
  collateralOracle?: Address;
  poolPriceSource?: Address;
  refOracle?: Address;
  mockVault?: Address;
  tasks: Record<string, TaskDeployment>;
}

export interface ResolvedDeployment extends Deployment {
  /**
   * `file` once `packages/shared/deployments/<chainId>.json` has been wired in.
   * `placeholder` means Deploy.s.sol has not run for this chain yet — the UI
   * says so out loud rather than pretending these addresses are live.
   */
  source: "file" | "placeholder";
}

/**
 * Anvil is deterministic: account 0 sends every tx in Deploy.s.sol, so the
 * first four CREATEs land on well-known addresses. Later contracts depend on
 * intervening non-CREATE nonces, so they stay placeholder until the deploy
 * file is wired in.
 */
const ANVIL_PLACEHOLDER: Deployment = {
  chainId: 31_337,
  coordinator: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
  collateralOracle: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
  mockPool: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
  poolPriceSource: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
  refOracle: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
  mockVault: "0x5FC8d32690cc91D4c39d9d3abcBD16989F875707",
  tasks: {
    aave: {
      taskId: "0x9a1f0c7d84e2b5361fa0d78c93e15b204df6a8c17e0b3529d84fa61c07e5b3d2",
      predicate: "0x0165878A594ca255338adfa4d48449f69242Eb8F",
      label: "Aave liquidation",
    },
    arb: {
      taskId: "0x4e83b1d06c5fa2947e10d8b35c6f2091a7be4d35c108f9a26db73e05fc819a6e",
      predicate: "0xa513E6E4b8f2a923D98304ec87F64353C4D5C853",
      label: "DEX arbitrage",
    },
    cron: {
      taskId: "0x27c5e91af03b6d485210fc7e8b39d604a5e1cf72b806d31954ea7c02f6b18d43",
      predicate: "0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6",
      label: "Cron / harvest",
    },
  },
};

const MONAD_PLACEHOLDER: Deployment = {
  ...ANVIL_PLACEHOLDER,
  chainId: 10_143,
};

/**
 * Mirrors `loadDeployment(chainId)` from @…/shared. That version reads
 * `packages/shared/deployments/<chainId>.json` from disk; a browser cannot,
 * so the file gets imported here once the deploy script has run.
 */
export function loadDeployment(chainId: number): ResolvedDeployment {
  const base = chainId === ANVIL.id ? ANVIL_PLACEHOLDER : MONAD_PLACEHOLDER;
  return { ...base, chainId, source: "placeholder" };
}

/** Base fee used wherever a gas figure is converted to MON. */
export const BASE_FEE_WEI = 50n * 10n ** 9n;
