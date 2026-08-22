export type Address = `0x${string}`;
export type Hex = `0x${string}`;

/** The three reference predicates registered by Deploy.s.sol. */
export type Category = "liquidation" | "dex-arb" | "cron";

/** The checkParam shape a predicate expects. */
export type CheckParamShape = "address" | "price" | "interval";

/**
 * Trust tiers are a UI-side curation concern. The coordinator does not know
 * they exist; the keeper daemon has its own `onlyVerifiedTasks` allowlist.
 */
export type TrustTier = "verified" | "community" | "flagged";

/** ICoordinator.ClaimStatus — order matters, it is an on-chain enum. */
export type ClaimStatus = "None" | "Active" | "Fulfilled" | "Released" | "Slashed";

/**
 * ICoordinator.Task. Every field is immutable and folded into
 * `computeTaskId(predicate, checkParam, windowBlocks, bondWei, bountyPerJob, sponsor)`.
 */
export interface TaskParams {
  predicate: Address;
  checkParam: Hex;
  /** uint32 */
  windowBlocks: number;
  /** uint96 */
  bondWei: bigint;
  /** uint96 — paid to the keeper on consume. 0 means self-funding MEV. */
  bountyPerJob: bigint;
  sponsor: Address;
  /** Sponsor may deactivate; blocks NEW claims only. */
  active: boolean;
}

/** taskStats(taskId) -> (claims, fulfilled, slashed, released) */
export interface TaskStats {
  claims: number;
  fulfilled: number;
  slashed: number;
  released: number;
}

export interface Task {
  taskId: Hex;
  label: string;
  category: Category;
  checkParamShape: CheckParamShape;
  params: TaskParams;
  stats: TaskStats;
  /** Block the TaskRegistered event was emitted at. */
  registeredAtBlock: number;
  ageDays: number;
  /** Subjects the frontend tracks for this task. */
  subjectCount: number;
  /** Live count for which isEligible() currently returns true. */
  eligibleSubjects: number;
  /** taskEscrow(taskId) */
  escrowWei: bigint;
  /** reservedEscrow(taskId) — backing currently-active claims. */
  reservedEscrowWei: bigint;
  /** Predicate source verified on the block explorer. */
  predicateVerified: boolean;
  predicateSourceUrl?: string;
  /** Bounties earned minus bonds slashed, summed across the event stream. */
  realisedKeeperPnlWei: bigint;
  /** Frontend allowlist — feeds the Verified tier. */
  curatedAllowlist: boolean;
  /** How many tasks this sponsor has registered historically. */
  sponsorTaskCount: number;
  /** Set when the protocol enforces `holder(...) == msg.sender` on its entry point. */
  enforced: boolean;
}

/** ICoordinator.Claim — one storage slot; the bond is not stored per claim. */
export interface ClaimRecord {
  keeper: Address;
  expiryBlock: number;
  status: ClaimStatus;
  /** Derived from the Claimed event, not from the struct. */
  claimedAtBlock: number;
}

/** A row in the live subject table on the task detail screen. */
export interface SubjectRow {
  subject: Hex;
  address: Address;
  label: string;
  /** coordinator.isEligible(taskId, subject) */
  eligible: boolean;
  /** coordinator.holder(taskId, subject) — zero address means nobody holds rights. */
  holder: Address | null;
  claim: ClaimRecord | null;
  /** Category-specific readout, e.g. "HF 0.91" or "spread 200 bps". */
  metric: string;
  metricTone: "ok" | "warn" | "bad" | "neutral";
}

export type CoordinatorEventKind =
  | "Claimed"
  | "Consumed"
  | "Resolved"
  | "TaskRegistered"
  | "TaskFunded"
  | "TaskDeactivated"
  | "TaskFundsWithdrawn"
  | "Withdrawal";

export interface CoordinatorEvent {
  id: string;
  kind: CoordinatorEventKind;
  taskId: Hex;
  subject?: Hex;
  keeper?: Address;
  blockNumber: number;
  timestamp: string;
  /** Claimed */
  expiryBlock?: number;
  bondWei?: bigint;
  /** Resolved — true = grief slash, false = self-heal refund. */
  slashed?: boolean;
  /** Resolved — whoever called resolve() and collected SLASH_REWARD. */
  resolver?: Address;
  /** TaskFunded / TaskFundsWithdrawn / Withdrawal */
  amountWei?: bigint;
}

/* ------------------------------------------------------------------ */
/* Keeper daemon — mirrors keeper/src/types.ts                         */
/* ------------------------------------------------------------------ */

/** keeper/src/types.ts SafetyLimits. MON amounts are decimal strings in YAML. */
export interface SafetyLimits {
  maxBondPerClaim: string;
  maxConcurrentClaims: number;
  maxDailyBondExposure: string;
  onlyVerifiedTasks: boolean;
  minTaskAgeBlocks: number;
  maxTaskSlashRate: number;
  requireStableEligible: number;
  dryRun: boolean;
}

/** keeper/src/types.ts TaskConfig. */
export interface KeeperTaskConfig {
  taskId: Hex;
  subjects: Address[];
  /** A TIGHT declared limit is the whole point — you pay what you declare. */
  claimGasLimit: number;
  performGasLimit: number;
  payload: Hex;
}

/** keeper/src/types.ts KeeperConfig — what keeper.yml deserialises into. */
export interface KeeperConfig {
  rpc: string;
  chainId: number;
  account: string;
  coordinator?: Address;
  executor?: Address;
  label: string;
  pollIntervalMs: number;
  safety: SafetyLimits;
  tasks: KeeperTaskConfig[];
}

/** keeper/src/keeper.ts Outcome. */
export type KeeperOutcome =
  | "won"
  | "stood-down"
  | "lost-race"
  | "skipped"
  | "ineligible"
  | "dry-run";

export interface ActiveClaim {
  taskId: Hex;
  taskLabel: string;
  subject: Hex;
  subjectLabel: string;
  expiryBlock: number;
  bondWei: bigint;
  bountyWei: bigint;
  status: ClaimStatus;
}

/**
 * Emitted when the daemon declined to act because a rival holds the claim.
 * `keeper/src/keeper.ts` logs this as the "stood-down" outcome — it is the
 * coordination layer visibly working.
 */
export interface StandDownRecord {
  id: string;
  taskId: Hex;
  taskLabel: string;
  subject: Hex;
  subjectLabel: string;
  holder: Address;
  blockNumber: number;
  timestamp: string;
  /** Declared limit the keeper would have burned had it raced anyway. */
  gasAvoided: number;
}

export interface KeeperSnapshot {
  operator: Address;
  executor: Address;
  label: string;
  mode: "managed" | "advanced";
  activeClaims: ActiveClaim[];
  bondAtRiskWei: bigint;
  todayExposureWei: bigint;
  /** withdrawable(operator) on the coordinator — pull payment. */
  withdrawableWei: bigint;
  realisedPnlWei: bigint;
  bountiesEarnedWei: bigint;
  bondsSlashedWei: bigint;
  standDowns: StandDownRecord[];
  outcomes: Record<KeeperOutcome, number>;
  safety: SafetyLimits;
}

/* ------------------------------------------------------------------ */
/* Predicate probe (register screen)                                   */
/* ------------------------------------------------------------------ */

export interface PredicateProbe {
  ok: boolean;
  eligible: boolean;
  gasUsed: number;
  /** Coordinator.PREDICATE_GAS_CAP */
  gasCap: number;
  reverted: boolean;
  error?: string;
}

/* ------------------------------------------------------------------ */
/* Experiment                                                          */
/* ------------------------------------------------------------------ */

export type BotOutcome =
  | "idle"
  | "sending"
  | "success"
  | "reverted"
  | "claiming"
  | "claim-won"
  | "stood-down"
  | "executing";

export interface BotState {
  id: string;
  label: string;
  outcome: BotOutcome;
  /** What the tx declared — what Monad bills. */
  declaredGas: number;
  /** What execution actually consumed — what Ethereum would bill. */
  usedGas: number;
  note: string;
}

/** Mirrors experiment/src/report.ts RoundMetrics. */
export interface RoundMetrics {
  label: "naive" | "coordinated";
  txCount: number;
  declaredExposureGas: number;
  usedGas: number;
  blockGasReserved: number;
  usefulWorkRatio: number;
}

export interface ExperimentRound {
  metrics: RoundMetrics;
  bots: BotState[];
}

export interface MockPosition {
  user: Address;
  /** 1e18 collateral token amount. */
  collateral: number;
  /** 1e18 base-unit debt. */
  debt: number;
  collateralPrice: number;
  /** EnforcedMockPool.LIQUIDATION_THRESHOLD = 0.85e18 */
  liquidationThreshold: number;
}
