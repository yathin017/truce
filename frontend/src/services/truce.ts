/**
 * TRUCE console service layer — the single swap seam.
 *
 * Every function is named and shaped after the coordinator call it will make.
 * When the console is pointed at a live chain, the bodies become viem reads
 * against `coordinatorAbi` and nothing in `components/` changes:
 *
 *   listTasks()      -> TaskRegistered log scan + getTask(taskId)
 *   getSubjects()    -> multicall isEligible / holder / getClaim
 *   getTaskEvents()  -> Claimed / Consumed / Resolved log stream
 *   probePredicate() -> staticcall isEligible with a PREDICATE_GAS_CAP budget
 *   computeTaskId()  -> Coordinator.computeTaskId (pure)
 *
 * Until then it serves the exact world `contracts/script/Deploy.s.sol` builds:
 * one Coordinator, three predicates, three registered tasks.
 */

import { sleep } from "@/lib/utils";
import {
  BASE_FEE_WEI,
  DEFAULT_BOND_WEI,
  DEFAULT_WINDOW_BLOCKS,
  MONAD_TESTNET,
  PREDICATE_GAS_CAP,
  PERFORM_GAS_LIMIT,
  loadDeployment,
} from "@/lib/chain";
import {
  packIntervalParam,
  packPriceParam,
  subjectFromAddress,
  isAddress,
} from "@/lib/encoding";
import type {
  Address,
  ClaimRecord,
  CoordinatorEvent,
  Hex,
  KeeperSnapshot,
  MockPosition,
  PredicateProbe,
  SubjectRow,
  Task,
  TaskParams,
} from "@/types/truce";

const LATENCY = 160;
const MON = 10n ** 18n;

export const DEPLOYMENT = loadDeployment(MONAD_TESTNET.id);

/** Deploy.s.sol DEMO_USER — the seeded lending position. */
export const DEMO_USER = "0x00000000000000000000000000000000000A11cE" as Address;

/** Deploy.s.sol constants for the three reference tasks. */
const ARB_THRESHOLD_BPS = 100; // 1%
const HARVEST_INTERVAL_SECONDS = 3_600; // 1 hour
const CRON_BOUNTY_WEI = 50_000_000_000_000_000n; // 0.05 MON
const CRON_ESCROW_WEI = MON; // registerTask{value: 1 ether}

/** Simulated chain head. Everything block-relative derives from this. */
export const HEAD_BLOCK = 18_402_611;

export function currentBlock(): number {
  return HEAD_BLOCK;
}

export function baseFeeWei(): bigint {
  return BASE_FEE_WEI;
}

/* ------------------------------------------------------------------ */
/* Demo position — EnforcedMockPool                                    */
/* ------------------------------------------------------------------ */

/** Deploy.s.sol: createPosition(DEMO_USER, 10e18, 7500e18) at $1000. */
export const DEMO_POSITION: MockPosition = {
  user: DEMO_USER,
  collateral: 10,
  debt: 7_500,
  collateralPrice: 1_000,
  liquidationThreshold: 0.85,
};

/** RegisterTasks.s.sol / the experiment drop the price to $800. */
export const DROPPED_PRICE = 800;

/* ------------------------------------------------------------------ */
/* Tasks — exactly what Deploy.s.sol registers                         */
/* ------------------------------------------------------------------ */

const SPONSOR = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as Address; // deployer

const POOL = (DEPLOYMENT.mockPool ?? SPONSOR) as Address;
const POOL_PRICE = (DEPLOYMENT.poolPriceSource ?? SPONSOR) as Address;
const REF_ORACLE = (DEPLOYMENT.refOracle ?? SPONSOR) as Address;
const VAULT = (DEPLOYMENT.mockVault ?? SPONSOR) as Address;

const TASKS: Task[] = [
  {
    taskId: DEPLOYMENT.tasks.aave.taskId,
    label: "Aave-style liquidation",
    category: "liquidation",
    checkParamShape: "address",
    params: {
      predicate: DEPLOYMENT.tasks.aave.predicate,
      checkParam: subjectFromAddress(POOL),
      windowBlocks: DEFAULT_WINDOW_BLOCKS,
      bondWei: DEFAULT_BOND_WEI,
      bountyPerJob: 0n,
      sponsor: SPONSOR,
      active: true,
    },
    stats: { claims: 214, fulfilled: 197, slashed: 6, released: 11 },
    registeredAtBlock: 17_991_402,
    ageDays: 19,
    subjectCount: 1,
    eligibleSubjects: 0,
    escrowWei: 0n,
    reservedEscrowWei: 0n,
    predicateVerified: true,
    realisedKeeperPnlWei: (MON * 4_325n) / 1_000n,
    curatedAllowlist: true,
    sponsorTaskCount: 3,
    enforced: true,
  },
  {
    taskId: DEPLOYMENT.tasks.arb.taskId,
    label: "DEX arbitrage — pool vs oracle",
    category: "dex-arb",
    checkParamShape: "price",
    params: {
      predicate: DEPLOYMENT.tasks.arb.predicate,
      checkParam: packPriceParam(ARB_THRESHOLD_BPS, REF_ORACLE),
      windowBlocks: DEFAULT_WINDOW_BLOCKS,
      bondWei: DEFAULT_BOND_WEI,
      bountyPerJob: 0n,
      sponsor: SPONSOR,
      active: true,
    },
    stats: { claims: 88, fulfilled: 71, slashed: 4, released: 13 },
    registeredAtBlock: 18_204_887,
    ageDays: 9,
    subjectCount: 1,
    eligibleSubjects: 0,
    escrowWei: 0n,
    reservedEscrowWei: 0n,
    predicateVerified: true,
    realisedKeeperPnlWei: (MON * 908n) / 1_000n,
    curatedAllowlist: true,
    sponsorTaskCount: 3,
    enforced: false,
  },
  {
    taskId: DEPLOYMENT.tasks.cron.taskId,
    label: "Cron / harvest — 1h interval",
    category: "cron",
    checkParamShape: "interval",
    params: {
      predicate: DEPLOYMENT.tasks.cron.predicate,
      checkParam: packIntervalParam(HARVEST_INTERVAL_SECONDS),
      windowBlocks: DEFAULT_WINDOW_BLOCKS,
      bondWei: DEFAULT_BOND_WEI,
      bountyPerJob: CRON_BOUNTY_WEI,
      sponsor: SPONSOR,
      active: true,
    },
    stats: { claims: 41, fulfilled: 40, slashed: 0, released: 1 },
    registeredAtBlock: 18_318_020,
    ageDays: 4,
    subjectCount: 1,
    eligibleSubjects: 1,
    escrowWei: CRON_ESCROW_WEI - CRON_BOUNTY_WEI * 8n,
    reservedEscrowWei: CRON_BOUNTY_WEI,
    predicateVerified: true,
    realisedKeeperPnlWei: (MON * 400n) / 1_000n,
    curatedAllowlist: false,
    sponsorTaskCount: 3,
    enforced: false,
  },
];

export const KEEPERS = {
  k1: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
  k2: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address,
  k3: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address,
  k4: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" as Address,
};

/** The connected operator in this console. Anvil keeper #1. */
export const CONNECTED_OPERATOR = KEEPERS.k1;
export const CONNECTED_EXECUTOR = "0x8A791620dd6260079BF849Dc5567aDC3F2FdC318" as Address;

/* ------------------------------------------------------------------ */
/* Subjects                                                            */
/* ------------------------------------------------------------------ */

interface SubjectSeed {
  address: Address;
  label: string;
  eligible: boolean;
  metric: string;
  metricTone: SubjectRow["metricTone"];
  holder?: Address;
  claimBlocksAgo?: number;
}

function subjectSeeds(taskId: string): SubjectSeed[] {
  if (taskId === DEPLOYMENT.tasks.aave.taskId) {
    return [
      {
        address: DEMO_USER,
        label: "demo position (Alice)",
        eligible: false,
        metric: "HF 1.13",
        metricTone: "ok",
      },
    ];
  }
  if (taskId === DEPLOYMENT.tasks.arb.taskId) {
    return [
      {
        address: POOL_PRICE,
        label: "pool price source",
        eligible: false,
        metric: "spread 0 bps",
        metricTone: "ok",
      },
    ];
  }
  if (taskId === DEPLOYMENT.tasks.cron.taskId) {
    return [
      {
        address: VAULT,
        label: "MockVault",
        eligible: true,
        metric: "interval elapsed",
        metricTone: "bad",
        holder: KEEPERS.k2,
        claimBlocksAgo: 1,
      },
    ];
  }
  return [];
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

export async function listTasks(): Promise<Task[]> {
  await sleep(LATENCY);
  return TASKS;
}

export async function getTask(taskId: string): Promise<Task | null> {
  await sleep(LATENCY);
  return TASKS.find((t) => t.taskId.toLowerCase() === taskId.toLowerCase()) ?? null;
}

export async function getSubjects(taskId: string): Promise<SubjectRow[]> {
  await sleep(LATENCY);
  const task = TASKS.find((t) => t.taskId.toLowerCase() === taskId.toLowerCase());
  const windowBlocks = task?.params.windowBlocks ?? DEFAULT_WINDOW_BLOCKS;

  return subjectSeeds(taskId).map((seed) => {
    const claimedAtBlock = HEAD_BLOCK - (seed.claimBlocksAgo ?? 0);
    const claim: ClaimRecord | null = seed.holder
      ? {
          keeper: seed.holder,
          expiryBlock: claimedAtBlock + windowBlocks,
          status: "Active",
          claimedAtBlock,
        }
      : null;

    return {
      subject: subjectFromAddress(seed.address),
      address: seed.address,
      label: seed.label,
      eligible: seed.eligible,
      holder: seed.holder ?? null,
      claim,
      metric: seed.metric,
      metricTone: seed.metricTone,
    };
  });
}

interface EventSeed {
  kind: CoordinatorEvent["kind"];
  blocksAgo: number;
  keeper?: Address;
  resolver?: Address;
  slashed?: boolean;
  amountWei?: bigint;
}

const EVENT_SEEDS: EventSeed[] = [
  { kind: "Claimed", blocksAgo: 1, keeper: KEEPERS.k2 },
  { kind: "Consumed", blocksAgo: 14, keeper: KEEPERS.k1 },
  { kind: "Claimed", blocksAgo: 16, keeper: KEEPERS.k1 },
  { kind: "Resolved", blocksAgo: 38, keeper: KEEPERS.k3, resolver: KEEPERS.k4, slashed: true },
  { kind: "Claimed", blocksAgo: 41, keeper: KEEPERS.k3 },
  { kind: "Consumed", blocksAgo: 63, keeper: KEEPERS.k2 },
  { kind: "Claimed", blocksAgo: 65, keeper: KEEPERS.k2 },
  { kind: "Resolved", blocksAgo: 92, keeper: KEEPERS.k1, resolver: KEEPERS.k2, slashed: false },
  { kind: "Claimed", blocksAgo: 95, keeper: KEEPERS.k1 },
];

export async function getTaskEvents(taskId: string): Promise<CoordinatorEvent[]> {
  await sleep(LATENCY);
  const task = TASKS.find((t) => t.taskId.toLowerCase() === taskId.toLowerCase());
  if (!task) return [];

  const seeds = subjectSeeds(taskId);
  const subject = seeds[0] ? subjectFromAddress(seeds[0].address) : undefined;

  const events: CoordinatorEvent[] = EVENT_SEEDS.map((seed, i) => {
    const blockNumber = HEAD_BLOCK - seed.blocksAgo;
    return {
      id: `${taskId.slice(0, 10)}-${i}`,
      kind: seed.kind,
      taskId: task.taskId,
      subject,
      keeper: seed.keeper,
      resolver: seed.resolver,
      slashed: seed.slashed,
      blockNumber,
      timestamp: blockTimestamp(blockNumber),
      expiryBlock:
        seed.kind === "Claimed" ? blockNumber + task.params.windowBlocks : undefined,
      bondWei: seed.kind === "Claimed" ? task.params.bondWei : task.params.bondWei,
    };
  });

  if (task.params.bountyPerJob > 0n) {
    events.push({
      id: `${taskId.slice(0, 10)}-fund`,
      kind: "TaskFunded",
      taskId: task.taskId,
      blockNumber: task.registeredAtBlock,
      timestamp: blockTimestamp(task.registeredAtBlock),
      amountWei: CRON_ESCROW_WEI,
    });
  }

  events.push({
    id: `${taskId.slice(0, 10)}-reg`,
    kind: "TaskRegistered",
    taskId: task.taskId,
    blockNumber: task.registeredAtBlock,
    timestamp: blockTimestamp(task.registeredAtBlock),
  });

  return events.sort((a, b) => b.blockNumber - a.blockNumber);
}

/** Cross-task feed for the keeper console. */
export async function getRecentEvents(limit = 10): Promise<CoordinatorEvent[]> {
  const all = await Promise.all(TASKS.map((t) => getTaskEvents(t.taskId)));
  return all
    .flat()
    .filter((e) => e.kind === "Claimed" || e.kind === "Consumed" || e.kind === "Resolved")
    .sort((a, b) => b.blockNumber - a.blockNumber)
    .slice(0, limit);
}

function blockTimestamp(block: number): string {
  const msAgo = (HEAD_BLOCK - block) * MONAD_TESTNET.blockMs;
  return new Date(Date.UTC(2026, 7, 22, 14, 0, 0) - msAgo).toISOString();
}

/* ------------------------------------------------------------------ */
/* Keeper console                                                      */
/* ------------------------------------------------------------------ */

export async function getKeeperSnapshot(): Promise<KeeperSnapshot> {
  await sleep(LATENCY);
  const cron = TASKS[2];
  const aave = TASKS[0];

  return {
    operator: CONNECTED_OPERATOR,
    executor: CONNECTED_EXECUTOR,
    label: "K1",
    mode: "managed",
    activeClaims: [
      {
        taskId: cron.taskId,
        taskLabel: cron.label,
        subject: subjectFromAddress(VAULT),
        subjectLabel: "MockVault",
        expiryBlock: HEAD_BLOCK + 2,
        bondWei: cron.params.bondWei,
        bountyWei: cron.params.bountyPerJob,
        status: "Active",
      },
    ],
    bondAtRiskWei: cron.params.bondWei,
    todayExposureWei: (MON * 74n) / 1_000n,
    withdrawableWei: (MON * 312n) / 1_000n,
    realisedPnlWei: (MON * 287n) / 1_000n,
    bountiesEarnedWei: (MON * 337n) / 1_000n,
    bondsSlashedWei: (MON * 50n) / 1_000n,
    standDowns: [
      {
        id: "sd-1",
        taskId: aave.taskId,
        taskLabel: aave.label,
        subject: subjectFromAddress(DEMO_USER),
        subjectLabel: "demo position (Alice)",
        holder: KEEPERS.k2,
        blockNumber: HEAD_BLOCK - 1,
        timestamp: blockTimestamp(HEAD_BLOCK - 1),
        gasAvoided: PERFORM_GAS_LIMIT,
      },
      {
        id: "sd-2",
        taskId: cron.taskId,
        taskLabel: cron.label,
        subject: subjectFromAddress(VAULT),
        subjectLabel: "MockVault",
        holder: KEEPERS.k3,
        blockNumber: HEAD_BLOCK - 27,
        timestamp: blockTimestamp(HEAD_BLOCK - 27),
        gasAvoided: PERFORM_GAS_LIMIT,
      },
    ],
    outcomes: {
      won: 14,
      "stood-down": 2,
      "lost-race": 3,
      skipped: 1,
      ineligible: 486,
      "dry-run": 0,
    },
    safety: {
      maxBondPerClaim: "0.05",
      maxConcurrentClaims: 5,
      maxDailyBondExposure: "1.0",
      onlyVerifiedTasks: true,
      minTaskAgeBlocks: 0,
      maxTaskSlashRate: 0.1,
      requireStableEligible: 1,
      dryRun: false,
    },
  };
}

/* ------------------------------------------------------------------ */
/* Register screen                                                     */
/* ------------------------------------------------------------------ */

/**
 * `staticcall isEligible(subject, checkParam)` against the predicate with a
 * PREDICATE_GAS_CAP budget — exactly what `Coordinator._eligible` does.
 * Fail-closed: a revert or non-bool return means ineligible, never an error.
 */
export async function probePredicate(input: {
  predicate: string;
  subject: string;
  checkParam: string;
}): Promise<PredicateProbe> {
  await sleep(380);

  if (!isAddress(input.predicate)) {
    return {
      ok: false,
      eligible: false,
      gasUsed: 0,
      gasCap: PREDICATE_GAS_CAP,
      reverted: false,
      error: "predicate is not a 20-byte address",
    };
  }

  const seed = hashString(
    input.predicate.toLowerCase() + input.subject + input.checkParam,
  );

  // Reverting predicate — the coordinator treats this as "not eligible".
  if (seed % 19 === 0) {
    return {
      ok: false,
      eligible: false,
      gasUsed: 0,
      gasCap: PREDICATE_GAS_CAP,
      reverted: true,
      error: "staticcall reverted — coordinator will read this as ineligible",
    };
  }

  // Real reference predicates land well under 15k; a heavy one blows the cap.
  const gasUsed = 8_400 + (seed % 62_000);
  const overCap = gasUsed > PREDICATE_GAS_CAP;

  return {
    ok: !overCap,
    eligible: seed % 3 !== 0,
    gasUsed,
    gasCap: PREDICATE_GAS_CAP,
    reverted: false,
    error: overCap
      ? `isEligible burns ${gasUsed.toLocaleString("en-US")} gas — over the ${PREDICATE_GAS_CAP.toLocaleString("en-US")} cap, so claim() will always see "not eligible"`
      : undefined,
  };
}

/**
 * Coordinator.computeTaskId — keccak256(abi.encode(predicate, checkParam,
 * windowBlocks, bondWei, bountyPerJob, sponsor)).
 *
 * This stand-in is deterministic on the same six fields so the preview is
 * stable; swapping in viem's `keccak256(encodeAbiParameters(...))` makes it
 * byte-exact.
 */
export function computeTaskId(params: TaskParams): Hex {
  const payload = [
    params.predicate.toLowerCase(),
    params.checkParam.toLowerCase(),
    params.windowBlocks,
    params.bondWei.toString(),
    params.bountyPerJob.toString(),
    params.sponsor.toLowerCase(),
  ].join("|");

  let out = "";
  let h = hashString(payload);
  for (let i = 0; i < 8; i += 1) {
    h = (h * 1_664_525 + 1_013_904_223) >>> 0;
    out += h.toString(16).padStart(8, "0");
  }
  return `0x${out}` as Hex;
}

function hashString(input: string): number {
  let h = 2_166_136_261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16_777_619) >>> 0;
  }
  return h >>> 0;
}

/* ------------------------------------------------------------------ */
/* Writes                                                              */
/* ------------------------------------------------------------------ */

export interface TxReceipt {
  txHash: Hex;
  blockNumber: number;
}

async function fakeTx(): Promise<TxReceipt> {
  await sleep(1_300);
  let hex = "";
  for (let i = 0; i < 64; i += 1) {
    hex += "0123456789abcdef"[Math.floor(Math.random() * 16)];
  }
  return { txHash: `0x${hex}` as Hex, blockNumber: HEAD_BLOCK + 1 };
}

/** coordinator.registerTask{value: escrow}(...) */
export async function registerTask(
  params: TaskParams,
): Promise<TxReceipt & { taskId: Hex }> {
  const receipt = await fakeTx();
  return { ...receipt, taskId: computeTaskId(params) };
}

/** coordinator.fundTask{value: amount}(taskId) */
export async function fundTask(_taskId: string, _amountWei: bigint): Promise<TxReceipt> {
  return fakeTx();
}

/** executor.reserve{value: bond}(taskId, subject) — the cheap claim. */
export async function reserveClaim(_taskId: string, _subject: string): Promise<TxReceipt> {
  return fakeTx();
}

/** coordinator.resolve(taskId, subject) — settle an expired claim. */
export async function resolveClaim(_taskId: string, _subject: string): Promise<TxReceipt> {
  return fakeTx();
}

/** executor.collect() -> coordinator.withdraw() then forward to operator. */
export async function collect(): Promise<TxReceipt> {
  return fakeTx();
}
