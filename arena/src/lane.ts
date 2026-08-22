import type { Abi, Hex } from "viem";
import {
  baseExecutorAbi,
  enforcedMockPoolAbi,
  mockArbPoolAbi,
  mockCronJobAbi,
} from "@truce/shared/abis";
import { reserve, perform } from "@truce/keeper/executor";
import { send } from "./chain.js";
import { estimateRaw, perBotLimits, declaredFromRaw, botFactor, floorFor } from "./gas.js";
import type { Arena, LaneWorld } from "./world.js";
import { DEMO_USER } from "./world.js";
import type { LaneId, RoundRecord, SideResult, TxRecord, TxRole } from "./types.js";

const WAD = 10n ** 18n;

export type Spend = (billedWei: bigint) => void;

function txRecord(
  side: TxRecord["side"],
  role: TxRole,
  botIndex: number,
  declaredGas: bigint,
  res: { hash: Hex; gasUsed: bigint; gasPrice: bigint; success: boolean },
  explorerBase: string,
): TxRecord {
  return {
    side,
    role,
    botIndex,
    hash: res.hash,
    from: "0x0000000000000000000000000000000000000000",
    gasLimit: declaredGas.toString(),
    gasUsed: res.gasUsed.toString(),
    gasBilledWei: (declaredGas * res.gasPrice).toString(),
    gasPriceWei: res.gasPrice.toString(),
    success: res.success,
    explorerUrl: explorerBase ? `${explorerBase}/tx/${res.hash}` : "",
  };
}

function summarize(txs: TxRecord[]): Pick<SideResult, "declaredWei" | "gasReserved" | "winnerBot"> {
  let declared = 0n;
  let reserved = 0n;
  let winner = -1;
  for (const t of txs) {
    declared += BigInt(t.gasBilledWei);
    reserved += BigInt(t.gasLimit);
    if (t.success && (t.role === "execute" || t.role === "liquidate" || t.role === "arb" || t.role === "harvest")) {
      winner = t.botIndex;
    }
  }
  return { declaredWei: declared.toString(), gasReserved: reserved.toString(), winnerBot: winner };
}

/** Refill both targets so the opportunity is live on the naive and coordinated sides. */
async function reset(arena: Arena, lane: LaneWorld, spend: Spend): Promise<void> {
  const d = arena.deployer;
  const acc = (r: { billedWei: bigint }) => spend(r.billedWei);
  if (lane.id === "liquidation") {
    // Shared oracle: dropping the price once makes both pools' positions unhealthy.
    acc(await send(d, lane.coordTarget, enforcedMockPoolAbi as never, "setCollateralPrice", [800n * WAD]));
    for (const pool of [lane.naiveTarget, lane.coordTarget]) {
      acc(await send(d, pool, enforcedMockPoolAbi as never, "createPosition", [DEMO_USER, 10n * WAD, 7_500n * WAD]));
    }
  } else if (lane.id === "arb") {
    for (const pool of [lane.naiveTarget, lane.coordTarget]) {
      acc(await send(d, pool, mockArbPoolAbi as never, "pushOffPeg", [1_050n * WAD]));
    }
  } else {
    for (const job of [lane.naiveTarget, lane.coordTarget]) {
      acc(await send(d, job, mockCronJobAbi as never, "refill", []));
    }
  }
}

function naiveCall(lane: LaneWorld): { abi: Abi; fn: string; args: unknown[]; role: TxRole } {
  switch (lane.id) {
    case "liquidation":
      return { abi: enforcedMockPoolAbi as Abi, fn: "liquidate", args: [DEMO_USER], role: "liquidate" };
    case "arb":
      return { abi: mockArbPoolAbi as Abi, fn: "arb", args: [], role: "arb" };
    case "cron":
      return { abi: mockCronJobAbi as Abi, fn: "harvest", args: [], role: "harvest" };
  }
}

/**
 * Estimate the success-path work once, while the opportunity is live (before any bot consumes
 * it). This single number seeds both the naive limits and the coordinated execution limit — they
 * perform the same work — so the two sides can never invert just because one estimate fell back.
 */
async function estimateWorkRaw(arena: Arena, lane: LaneWorld): Promise<bigint> {
  const { abi, fn, args, role } = naiveCall(lane);
  const first = arena.botClients[0]!;
  return estimateRaw(role, arena.cfg.chainId, {
    publicClient: first.publicClient,
    account: first.account,
    address: lane.naiveTarget,
    abi,
    functionName: fn,
    args,
  });
}

/**
 * Naive round: every bot fires the expensive action directly; one lands, the rest revert.
 * Each bot pads the shared work estimate by its own margin (distinct, realistic limits).
 */
async function runNaive(arena: Arena, lane: LaneWorld, workRaw: bigint, spend: Spend): Promise<TxRecord[]> {
  const { abi, fn, args, role } = naiveCall(lane);
  const explorer = arena.cfg.explorerBase;
  const limits = perBotLimits(workRaw, role, arena.cfg.chainId, arena.cfg.gasFactor, arena.botClients.length);

  const results = await Promise.allSettled(
    arena.botClients.map((bot, i) =>
      send(bot, lane.naiveTarget, abi as never, fn, args, { gas: limits[i]! }).then((res) => ({ i, res })),
    ),
  );
  const txs: TxRecord[] = [];
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { i, res } = r.value;
    spend(res.billedWei);
    const t = txRecord("naive", role, i, limits[i]!, res, explorer);
    t.from = arena.botClients[i]!.account.address;
    txs.push(t);
  }

  const winners = txs.filter((tx) => tx.success).length;
  if (txs.length !== arena.botClients.length || winners !== 1) {
    const rejected = results.filter((r) => r.status === "rejected").length;
    throw new Error(
      `${lane.id} naive race incomplete: expected ${arena.botClients.length} receipts and one winner, got ${txs.length} receipts, ${winners} winners, ${rejected} submission errors`,
    );
  }
  return txs;
}

/**
 * Coordinated round: every bot fires the cheap claim; the winner executes using the same
 * success-path estimate that sized the naive race.
 */
async function runCoordinated(
  arena: Arena,
  lane: LaneWorld,
  workRaw: bigint,
  spend: Spend,
): Promise<TxRecord[]> {
  const explorer = arena.cfg.explorerBase;
  const bond = await bondOf(arena, lane);
  const first = arena.botClients[0]!;

  // Estimate the cheap claim once; each bot pads it by its own margin (distinct limits).
  const claimRaw = await estimateRaw("claim", arena.cfg.chainId, {
    publicClient: first.publicClient,
    account: first.account,
    address: lane.executors[0]!,
    abi: baseExecutorAbi as Abi,
    functionName: "reserve",
    args: [lane.taskId, lane.subject],
    value: bond,
  });
  const claimLimits = perBotLimits(claimRaw, "claim", arena.cfg.chainId, arena.cfg.gasFactor, arena.botClients.length);

  const results = await Promise.allSettled(
    arena.botClients.map((bot, i) =>
      reserve(bot as never, lane.executors[i]!, lane.taskId, lane.subject, bond, claimLimits[i]!).then((tx) => ({ i, tx })),
    ),
  );

  const txs: TxRecord[] = [];
  let winner = -1;
  let winners = 0;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { i, tx } = r.value;
    const ok = tx.receipt.status === "success";
    spend(tx.gasLimit * tx.receipt.effectiveGasPrice);
    const rec = txRecord(
      "coordinated",
      "claim",
      i,
      tx.gasLimit,
      { hash: tx.hash, gasUsed: tx.receipt.gasUsed, gasPrice: tx.receipt.effectiveGasPrice, success: ok },
      explorer,
    );
    rec.from = arena.botClients[i]!.account.address;
    txs.push(rec);
    if (ok) {
      winner = i;
      winners += 1;
    }
  }
  const rejected = results.filter((r) => r.status === "rejected").length;
  if (winners !== 1 || winner < 0) {
    throw new Error(
      `${lane.id} coordinated claim race incomplete: expected ${arena.botClients.length} receipts and one winner, got ${txs.length} receipts, ${winners} winners, ${rejected} submission errors`,
    );
  }

  // The direct call and `perform` contain the same expensive work. Reusing the estimate keeps
  // the comparison stable when Monad's `eth_estimateGas` intermittently fails on one side.
  const performGas = declaredFromRaw(
    workRaw,
    botFactor(arena.cfg.gasFactor, winner),
    floorFor("execute", arena.cfg.chainId),
  );

  const perf = await perform(
    arena.botClients[winner] as never,
    lane.executors[winner]!,
    lane.taskId,
    lane.subject,
    "0x",
    performGas,
  );
  spend(perf.gasLimit * perf.receipt.effectiveGasPrice);
  const exec = txRecord(
    "coordinated",
    "execute",
    winner,
    perf.gasLimit,
    { hash: perf.hash, gasUsed: perf.receipt.gasUsed, gasPrice: perf.receipt.effectiveGasPrice, success: perf.receipt.status === "success" },
    explorer,
  );
  exec.from = arena.botClients[winner]!.account.address;
  txs.push(exec);
  if (!exec.success) {
    throw new Error(`${lane.id} coordinated execution reverted for winning keeper K${winner + 1}`);
  }
  // If some losing submissions failed before producing receipts, execute the valid winner first
  // so its claim is consumed, then reject the incomplete sample instead of leaving a live lock.
  if (txs.length !== arena.botClients.length + 1) {
    throw new Error(
      `${lane.id} coordinated claim race incomplete: expected ${arena.botClients.length} claim receipts, got ${txs.length - 1}, ${rejected} submission errors`,
    );
  }
  return txs;
}

async function bondOf(arena: Arena, lane: LaneWorld): Promise<bigint> {
  const { coordinatorAbi } = await import("@truce/shared/abis");
  const task = (await arena.deployer.publicClient.readContract({
    address: arena.world.coordinator,
    abi: coordinatorAbi as never,
    functionName: "getTask",
    args: [lane.taskId],
  })) as { bondWei: bigint };
  return task.bondWei;
}

function pct(naiveWei: bigint, coordWei: bigint): number {
  if (naiveWei === 0n) return 0;
  return Number(((naiveWei - coordWei) * 10_000n) / naiveWei) / 100;
}

/** Run one full lane round: reset → naive → coordinated → record. */
export async function runLaneRound(arena: Arena, laneId: LaneId, roundId: number, spend: Spend): Promise<RoundRecord> {
  const lane = arena.world.lanes[laneId];
  await reset(arena, lane, spend);

  const workRaw = await estimateWorkRaw(arena, lane);
  const naiveTxs = await runNaive(arena, lane, workRaw, spend);
  const coordTxs = await runCoordinated(arena, lane, workRaw, spend);

  const naive: SideResult = { txs: naiveTxs, ...summarize(naiveTxs) };
  const coordinated: SideResult = { txs: coordTxs, ...summarize(coordTxs) };

  return {
    id: roundId,
    lane: laneId,
    laneLabel: lane.label,
    ts: Date.now(),
    naive,
    coordinated,
    savingsPct: pct(BigInt(naive.declaredWei), BigInt(coordinated.declaredWei)),
  };
}
