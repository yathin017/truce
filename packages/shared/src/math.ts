import { formatEther } from "viem";

/** 1e18 fixed-point scale (WAD). */
export const WAD = 10n ** 18n;

/** Declared gas limit for the expensive execution (a real liquidation's success path). */
export const PERFORM_GAS_LIMIT = 500_000n;

/**
 * Declared gas limit for the cheap claim. The claim computes in ~113k of EVM gas, but
 * Monad's live metering runs materially higher for this multi-contract cold-access path
 * (a 150k-declared claim runs out on testnet; 200k succeeds), so it needs more headroom
 * there. Still far below {@link PERFORM_GAS_LIMIT} — that gap is the product.
 */
export function claimGasLimit(chainId: number): bigint {
  return chainId === 10143 ? 200_000n : 130_000n;
}

/**
 * Health factor, 1e18-scaled.
 * HF = collateralValue * liquidationThreshold / debtValue.
 * @param liquidationThresholdWad e.g. 0.8e18 for an 80% threshold.
 */
export function healthFactor(
  collateralValueWad: bigint,
  debtValueWad: bigint,
  liquidationThresholdWad: bigint,
): bigint {
  if (debtValueWad === 0n) return 2n ** 255n; // no debt ⇒ effectively infinite HF
  return (collateralValueWad * liquidationThresholdWad) / debtValueWad;
}

/** A position is liquidatable once HF drops below 1e18. */
export function isLiquidatable(healthFactorWad: bigint): boolean {
  return healthFactorWad < WAD;
}

export interface TxGas {
  /** Declared gas limit on the transaction (what Monad bills). */
  gasLimit: bigint;
  /** Gas actually consumed during execution (what Ethereum would bill on revert). */
  gasUsed: bigint;
  /** Effective gas price paid, in wei. */
  gasPrice: bigint;
}

/** Monad basis: charged = Σ gasLimit × gasPrice. */
export function declaredExposureWei(txs: readonly TxGas[]): bigint {
  return txs.reduce((acc, t) => acc + t.gasLimit * t.gasPrice, 0n);
}

/** Ethereum counterfactual: charged = Σ gasUsed × gasPrice. */
export function usedCostWei(txs: readonly TxGas[]): bigint {
  return txs.reduce((acc, t) => acc + t.gasUsed * t.gasPrice, 0n);
}

/** Total gas *limit* reserved from block capacity. */
export function blockGasReserved(txs: readonly TxGas[]): bigint {
  return txs.reduce((acc, t) => acc + t.gasLimit, 0n);
}

/** Fraction of reserved block gas that did useful work: Σ gasUsed / Σ gasLimit. */
export function usefulWorkRatio(txs: readonly TxGas[]): number {
  const reserved = blockGasReserved(txs);
  if (reserved === 0n) return 0;
  const used = txs.reduce((acc, t) => acc + t.gasUsed, 0n);
  return Number((used * 10_000n) / reserved) / 10_000;
}

/** Percent reduction from `before` to `after` (0..100). */
export function reductionPct(beforeWei: bigint, afterWei: bigint): number {
  if (beforeWei === 0n) return 0;
  return Number(((beforeWei - afterWei) * 10_000n) / beforeWei) / 100;
}

/** Format a wei amount as a MON string. */
export function formatMon(wei: bigint, maxDp = 6): string {
  const s = formatEther(wei);
  const [int, frac = ""] = s.split(".");
  return frac ? `${int}.${frac.slice(0, maxDp)} MON` : `${int} MON`;
}
