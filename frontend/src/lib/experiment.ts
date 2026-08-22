/**
 * The experiment, mirrored from `experiment/src/rounds.ts` + `report.ts`.
 *
 * Round A (naive): four keepers each fire the expensive liquidation directly at
 * a voluntary pool, each declaring the ~500k success-path limit. One lands, three
 * revert — and on Monad all four are billed their full declared limit.
 *
 * Round B (coordinated): four keepers each fire the cheap bonded claim (~130k).
 * One wins and performs the 500k liquidation; three paid only the tight claim
 * limit and stood down.
 *
 * The gas figures below are the anvil measurements recorded in the repo README.
 */

import type { BotState, ExperimentRound, MockPosition, RoundMetrics } from "@/types/truce";
import { CLAIM_GAS_LIMIT, PERFORM_GAS_LIMIT } from "./chain";

/* Measured on anvil (success path). */
const LIQUIDATION_GAS_USED = 109_000; // EnforcedMockPool.liquidate
const CLAIM_GAS_USED_VIA_EXECUTOR = 113_000; // executor.reserve -> coordinator.claim
const NAIVE_REVERT_GAS_USED = 10_300; // require("already liquidated")
const CLAIM_REVERT_GAS_USED = 18_000; // SubjectAlreadyClaimed()

export const KEEPER_LABELS = ["K1", "K2", "K3", "K4"] as const;
export const WINNER_INDEX = 1; // K2 lands first in both rounds

/* ------------------------------------------------------------------ */
/* Position                                                            */
/* ------------------------------------------------------------------ */

/** EnforcedMockPool.healthFactor — collateralValue × threshold / debt. */
export function healthFactorAt(position: MockPosition, price: number): number {
  if (position.debt <= 0) return Number.POSITIVE_INFINITY;
  return (position.collateral * price * position.liquidationThreshold) / position.debt;
}

export function isLiquidatable(hf: number): boolean {
  return hf < 1;
}

/* ------------------------------------------------------------------ */
/* Rounds                                                              */
/* ------------------------------------------------------------------ */

function metricsFor(label: RoundMetrics["label"], bots: BotState[], extra?: BotState) {
  const txs = extra ? [...bots, extra] : bots;
  const declared = txs.reduce((a, b) => a + b.declaredGas, 0);
  const used = txs.reduce((a, b) => a + b.usedGas, 0);
  return {
    label,
    txCount: txs.length,
    declaredExposureGas: declared,
    usedGas: used,
    blockGasReserved: declared,
    usefulWorkRatio: declared > 0 ? used / declared : 0,
  } satisfies RoundMetrics;
}

export function naiveRound(): ExperimentRound {
  const bots: BotState[] = KEEPER_LABELS.map((label, i) => {
    const won = i === WINNER_INDEX;
    return {
      id: label,
      label,
      outcome: won ? "success" : "reverted",
      declaredGas: PERFORM_GAS_LIMIT,
      usedGas: won ? LIQUIDATION_GAS_USED : NAIVE_REVERT_GAS_USED,
      note: won
        ? "liquidated the position"
        : 'reverted "already liquidated" — still billed the full declared limit',
    };
  });

  return { bots, metrics: metricsFor("naive", bots) };
}

export function coordinatedRound(): ExperimentRound {
  const bots: BotState[] = KEEPER_LABELS.map((label, i) => {
    const won = i === WINNER_INDEX;
    return {
      id: label,
      label,
      outcome: won ? "executing" : "stood-down",
      declaredGas: CLAIM_GAS_LIMIT,
      usedGas: won ? CLAIM_GAS_USED_VIA_EXECUTOR : CLAIM_REVERT_GAS_USED,
      note: won
        ? "won the claim — holds exclusive rights for 3 blocks"
        : "claim reverted SubjectAlreadyClaimed() — stood down for ~0.0065 MON",
    };
  });

  const perform: BotState = {
    id: "perform",
    label: `${KEEPER_LABELS[WINNER_INDEX]} · perform`,
    outcome: "success",
    declaredGas: PERFORM_GAS_LIMIT,
    usedGas: LIQUIDATION_GAS_USED,
    note: "executor.perform -> _work -> coordinator.consume",
  };

  return { bots: [...bots, perform], metrics: metricsFor("coordinated", bots, perform) };
}

/** The gas that produced the one piece of real work, in either round. */
export const USEFUL_GAS = LIQUIDATION_GAS_USED;

export const MEASURED = {
  liquidationGasUsed: LIQUIDATION_GAS_USED,
  claimGasUsedViaExecutor: CLAIM_GAS_USED_VIA_EXECUTOR,
  naiveRevertGasUsed: NAIVE_REVERT_GAS_USED,
  claimRevertGasUsed: CLAIM_REVERT_GAS_USED,
  claimGasLimit: CLAIM_GAS_LIMIT,
  performGasLimit: PERFORM_GAS_LIMIT,
};
