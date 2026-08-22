/**
 * Gas accounting — the core narrative.
 *
 * Monad bills the **declared gas limit**, not gas used. Every helper here
 * mirrors the surface that `@truce/shared` will expose once the backend
 * lands, so the frontend and the keeper daemon agree exactly.
 */

export const WEI_PER_MON = 10n ** 18n;
export const GWEI = 10n ** 9n;

/* ------------------------------------------------------------------ */
/* Position health                                                     */
/* ------------------------------------------------------------------ */

/** Aave-V3-compatible: (collateral * liquidationThreshold) / debt. */
export function healthFactor(
  collateralUsd: number,
  debtUsd: number,
  liquidationThreshold: number,
): number {
  if (debtUsd <= 0) return Number.POSITIVE_INFINITY;
  return (collateralUsd * liquidationThreshold) / debtUsd;
}

export function isLiquidatable(hf: number): boolean {
  return hf < 1;
}

/* ------------------------------------------------------------------ */
/* Cost bases                                                          */
/* ------------------------------------------------------------------ */

/** Monad basis — what you are actually charged. */
export function declaredExposureWei(gasLimit: number | bigint, baseFeeWei: bigint): bigint {
  return BigInt(gasLimit) * baseFeeWei;
}

/** Ethereum counterfactual — what gas-used billing would charge. */
export function usedCostWei(gasUsed: number | bigint, baseFeeWei: bigint): bigint {
  return BigInt(gasUsed) * baseFeeWei;
}

/** Block space reserved by a set of declared limits. */
export function blockGasReserved(gasLimits: number[]): number {
  return gasLimits.reduce((sum, g) => sum + g, 0);
}

/** Fraction of reserved block space that produced real work. */
export function usefulWorkRatio(usefulGas: number, reservedGas: number): number {
  if (reservedGas <= 0) return 0;
  return usefulGas / reservedGas;
}

/**
 * Signed reduction from `before` to `after`. Negative means the
 * "improvement" is actually a regression — which is exactly what the
 * gas-used basis shows, and we render it honestly.
 */
export function reductionPct(before: number | bigint, after: number | bigint): number {
  const b = Number(before);
  const a = Number(after);
  if (b <= 0) return 0;
  return ((b - a) / b) * 100;
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatMon(wei: bigint, maxDigits = 4): string {
  const negative = wei < 0n;
  const abs = negative ? -wei : wei;
  const whole = abs / WEI_PER_MON;
  const frac = abs % WEI_PER_MON;

  let fracStr = frac.toString().padStart(18, "0").slice(0, maxDigits);
  fracStr = fracStr.replace(/0+$/, "");

  const body = fracStr ? `${whole}.${fracStr}` : whole.toString();
  return `${negative ? "-" : ""}${body}`;
}

export function formatMonWithUnit(wei: bigint, maxDigits = 4): string {
  return `${formatMon(wei, maxDigits)} MON`;
}

export function formatGwei(wei: bigint): string {
  const whole = wei / GWEI;
  const frac = (wei % GWEI) / (GWEI / 100n);
  return frac > 0n ? `${whole}.${frac.toString().padStart(2, "0")}` : whole.toString();
}

/** 1_338_000 -> "1.34M" */
export function formatGas(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(value);
}

export function formatGasExact(value: number): string {
  return value.toLocaleString("en-US");
}

/* ------------------------------------------------------------------ */
/* Blocks <-> wall clock                                               */
/* ------------------------------------------------------------------ */

/** Windows are declared in blocks but operators think in milliseconds. */
export function blocksToMs(blocks: number, blockMs: number): number {
  return blocks * blockMs;
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(ms < 10_000 ? 1 : 0)}s`;
}

/** "3 blocks ≈ 1.2s" */
export function formatWindow(blocks: number, blockMs: number): string {
  return `${blocks} ${blocks === 1 ? "block" : "blocks"} ≈ ${formatDuration(
    blocksToMs(blocks, blockMs),
  )}`;
}
