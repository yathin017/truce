import type { TxGas } from "@truce/shared";
import { declaredExposureWei, usedCostWei, formatMon } from "@truce/shared";

export type TxKind = "claim" | "perform";

export interface GasRecord extends TxGas {
  kind: TxKind;
  keeper: string;
  success: boolean;
}

/**
 * Accumulates per-transaction gas so the keeper (and the experiment) can report the
 * Monad declared-limit exposure alongside the Ethereum gas-used counterfactual.
 */
export class GasLedger {
  readonly records: GasRecord[] = [];

  add(r: GasRecord): void {
    this.records.push(r);
  }

  /** Monad basis: what the chain actually bills = Σ gasLimit × gasPrice. */
  declaredExposureWei(): bigint {
    return declaredExposureWei(this.records);
  }

  /** Ethereum counterfactual: Σ gasUsed × gasPrice. */
  usedCostWei(): bigint {
    return usedCostWei(this.records);
  }

  summary(): string {
    const declared = this.declaredExposureWei();
    const used = this.usedCostWei();
    return `declared-limit exposure ${formatMon(declared)} | gas-used cost ${formatMon(used)}`;
  }
}
