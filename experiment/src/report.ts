import {
  declaredExposureWei,
  usedCostWei,
  blockGasReserved,
  usefulWorkRatio,
  reductionPct,
  formatMon,
} from "@reservoir/shared";
import type { RoundResult } from "./rounds.js";

export interface RoundMetrics {
  label: string;
  txCount: number;
  winner: number;
  declaredExposureWei: string; // Monad basis: Σ gasLimit × price
  usedCostWei: string; // Ethereum counterfactual: Σ gasUsed × price
  blockGasReserved: string;
  usefulWorkRatio: number;
}

export interface ExperimentReport {
  naive: RoundMetrics;
  coordinated: RoundMetrics;
  declaredReductionPct: number;
  blockGasReductionPct: number;
}

function metrics(r: RoundResult): RoundMetrics {
  return {
    label: r.label,
    txCount: r.txs.length,
    winner: r.winner,
    declaredExposureWei: declaredExposureWei(r.txs).toString(),
    usedCostWei: usedCostWei(r.txs).toString(),
    blockGasReserved: blockGasReserved(r.txs).toString(),
    usefulWorkRatio: usefulWorkRatio(r.txs),
  };
}

export function buildReport(naive: RoundResult, coordinated: RoundResult): ExperimentReport {
  const n = metrics(naive);
  const c = metrics(coordinated);
  return {
    naive: n,
    coordinated: c,
    declaredReductionPct: reductionPct(BigInt(n.declaredExposureWei), BigInt(c.declaredExposureWei)),
    blockGasReductionPct: reductionPct(BigInt(n.blockGasReserved), BigInt(c.blockGasReserved)),
  };
}

function bar(fraction: number, width = 32): string {
  const filled = Math.max(0, Math.min(width, Math.round(fraction * width)));
  return "█".repeat(filled) + "░".repeat(width - filled);
}

export function printReport(rep: ExperimentReport): void {
  const nDeclared = BigInt(rep.naive.declaredExposureWei);
  const cDeclared = BigInt(rep.coordinated.declaredExposureWei);
  const nReserved = BigInt(rep.naive.blockGasReserved);
  const cReserved = BigInt(rep.coordinated.blockGasReserved);

  console.log("\n══ Reservoir experiment ══════════════════════════════════════════\n");

  console.log("MON CHARGED  (declared-limit basis — what Monad actually bills)");
  console.log(`  Naive        ${bar(1)}  ${formatMon(nDeclared)}`);
  console.log(`  Coordinated  ${bar(Number(cDeclared) / Number(nDeclared))}  ${formatMon(cDeclared)}`);
  console.log(`  Reduction    ${rep.declaredReductionPct.toFixed(1)}%\n`);

  console.log("BLOCK GAS RESERVED");
  console.log(`  Naive        ${bar(1)}  ${nReserved}`);
  console.log(`  Coordinated  ${bar(Number(cReserved) / Number(nReserved))}  ${cReserved}`);
  console.log(`  Reduction    ${rep.blockGasReductionPct.toFixed(1)}%\n`);

  console.log("USEFUL-WORK RATIO  (gas used / gas reserved)");
  console.log(`  Naive        ${(rep.naive.usefulWorkRatio * 100).toFixed(1)}%`);
  console.log(`  Coordinated  ${(rep.coordinated.usefulWorkRatio * 100).toFixed(1)}%\n`);

  // Honesty: show the Ethereum counterfactual so the asymmetry is visible, not asserted.
  console.log("For reference — Ethereum accounting (gas USED, reverts refunded):");
  console.log(`  Naive        ${formatMon(BigInt(rep.naive.usedCostWei))}`);
  console.log(`  Coordinated  ${formatMon(BigInt(rep.coordinated.usedCostWei))}`);
  console.log("\n══════════════════════════════════════════════════════════════════\n");
}
