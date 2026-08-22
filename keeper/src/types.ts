import type { Address, Hex } from "viem";

export interface SafetyLimits {
  /** Max bond (MON) the keeper will lock on a single claim. */
  maxBondPerClaim: string;
  /** Max simultaneous active claims. */
  maxConcurrentClaims: number;
  /** Hard stop: cumulative bond (MON) risked per process run. */
  maxDailyBondExposure: string;
  /** Only act on tasks on the on-chain verified allowlist (curation). */
  onlyVerifiedTasks: boolean;
  /** Ignore tasks younger than this many blocks. */
  minTaskAgeBlocks: number;
  /** Refuse tasks whose slash rate exceeds this fraction (0..1). */
  maxTaskSlashRate: number;
  /** Require a subject to read eligible on N consecutive polls before claiming. */
  requireStableEligible: number;
  /** Never send state-changing txs; log intended actions only. */
  dryRun: boolean;
}

export interface TaskConfig {
  taskId: Hex;
  /** Explicit subjects (addresses or 32-byte hex). "auto" is not yet supported. */
  subjects: Address[] | "auto";
  /** Tight declared gas limit for the cheap claim — the whole point on Monad. */
  claimGasLimit: number;
  /** Declared gas limit for the expensive execution. */
  performGasLimit: number;
  /** Optional payload forwarded to executor.perform (e.g. abi-encoded arb price). */
  payload?: Hex;
}

export interface KeeperConfig {
  rpc: string;
  chainId: number;
  /** Keeper private key (0x-prefixed). Supports ${ENV_VAR} expansion. */
  account: Hex;
  /** Coordinator address; if omitted, loaded from the deployment file for chainId. */
  coordinator?: Address | undefined;
  /** This keeper's executor contract; required for `run`, optional for `simulate`. */
  executor?: Address | undefined;
  /** Human label for logs. */
  label?: string | undefined;
  pollIntervalMs: number;
  safety: SafetyLimits;
  tasks: TaskConfig[];
}
