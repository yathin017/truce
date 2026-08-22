export function shortAddress(address: string, lead = 5, tail = 3) {
  if (!address) return "";
  if (address.length <= lead + tail + 3) return address;
  return `${address.slice(0, lead)}...${address.slice(-tail)}`;
}

export function formatNumber(value: number, maximumFractionDigits = 0) {
  return value.toLocaleString("en-US", { maximumFractionDigits });
}

/** 1_338_000 -> "1.34M" — used for gas figures */
export function formatCompactGas(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}K`;
  return String(value);
}

export function formatUsd(value: number) {
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatMon(value: number) {
  return `${formatNumber(value)} MON`;
}

export function formatPercent(value: number, digits = 1) {
  return `${value.toFixed(digits)}%`;
}

export function reductionPercent(before: number, after: number) {
  if (before <= 0) return 0;
  return ((before - after) / before) * 100;
}
