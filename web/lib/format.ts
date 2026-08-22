const WAD = 10n ** 18n;

/** Format a wei string as a MON amount with adaptive precision. */
export function mon(wei: string | bigint, dp = 4): string {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  const int = v / WAD;
  const frac = v % WAD;
  const fracStr = frac.toString().padStart(18, "0").slice(0, dp);
  return `${int}.${fracStr}`;
}

export function gwei(wei: string | bigint): number {
  const v = typeof wei === "bigint" ? wei : BigInt(wei || "0");
  return Number(v / 10n ** 9n);
}

export function gasNum(g: string | number): string {
  return Number(g).toLocaleString("en-US");
}

export function shortHash(h: string, lead = 6, tail = 4): string {
  if (!h) return "";
  return `${h.slice(0, lead)}…${h.slice(-tail)}`;
}

export function pct(n: number, dp = 1): string {
  return `${n.toFixed(dp)}%`;
}

export function chainName(id: number): string {
  if (id === 10143) return "Monad testnet";
  if (id === 31337) return "Local anvil";
  return `Chain ${id}`;
}

/** Ratio of used gas to declared limit (0..1) — how much of the reserved gas did real work. */
export function usefulRatio(tx: { gasUsed: string; gasLimit: string }): number {
  const used = Number(tx.gasUsed);
  const limit = Number(tx.gasLimit);
  if (!limit) return 0;
  return Math.min(1, used / limit);
}
