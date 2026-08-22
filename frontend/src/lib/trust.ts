/**
 * Trust curation — a **frontend** concern.
 *
 * The coordinator does not know or care about tiers. These are computed
 * client-side from public on-chain statistics plus a curated allowlist,
 * and every badge exposes its reasons so nobody has to trust the label.
 */

import type { Task, TrustTier } from "@/types/truce";

export interface TrustAssessment {
  tier: TrustTier;
  /** 0..1 — drives the meter, not the tier. */
  score: number;
  slashRate: number;
  reasons: string[];
  warnings: string[];
}

/** slashed / claims. Zero claims means no evidence either way. */
export function slashRate(task: Task): number {
  const { claims, slashed } = task.stats;
  if (claims <= 0) return 0;
  return slashed / claims;
}

const FLAG_SLASH_RATE = 0.2;
const VERIFIED_SLASH_RATE = 0.05;
const VERIFIED_MIN_CLAIMS = 20;
const VERIFIED_MIN_AGE_DAYS = 7;

export function assessTrust(task: Task): TrustAssessment {
  const rate = slashRate(task);
  const reasons: string[] = [];
  const warnings: string[] = [];

  if (task.curatedAllowlist) reasons.push("On the TRUCE curated allowlist");
  if (task.predicateVerified) reasons.push("Predicate source verified on explorer");
  else warnings.push("Predicate source is not verified — bytecode only");

  if (task.stats.claims >= VERIFIED_MIN_CLAIMS) {
    reasons.push(`${task.stats.claims} claims settled`);
  } else {
    warnings.push(`Only ${task.stats.claims} claims so far — thin history`);
  }

  if (task.ageDays >= VERIFIED_MIN_AGE_DAYS) {
    reasons.push(`Registered ${task.ageDays}d ago`);
  } else {
    warnings.push(`Registered ${task.ageDays}d ago — new task`);
  }

  if (task.sponsorTaskCount > 1) {
    reasons.push(`Sponsor has run ${task.sponsorTaskCount} tasks`);
  } else {
    warnings.push("Sponsor's first task");
  }

  if (rate >= FLAG_SLASH_RATE) {
    warnings.push(`${(rate * 100).toFixed(0)}% of claims ended in a slash`);
  } else if (task.stats.claims > 0) {
    reasons.push(`${(rate * 100).toFixed(1)}% slash rate`);
  }

  if (task.realisedKeeperPnlWei < 0n) {
    warnings.push("Keepers are net negative on this task");
  }

  const tier: TrustTier =
    rate >= FLAG_SLASH_RATE || task.realisedKeeperPnlWei < 0n
      ? "flagged"
      : task.curatedAllowlist &&
          task.predicateVerified &&
          rate <= VERIFIED_SLASH_RATE &&
          task.stats.claims >= VERIFIED_MIN_CLAIMS &&
          task.ageDays >= VERIFIED_MIN_AGE_DAYS
        ? "verified"
        : "community";

  const score = clamp01(
    0.3 * (task.curatedAllowlist ? 1 : 0) +
      0.2 * (task.predicateVerified ? 1 : 0) +
      0.2 * clamp01(task.stats.claims / VERIFIED_MIN_CLAIMS) +
      0.15 * clamp01(task.ageDays / 30) +
      0.15 * (1 - clamp01(rate / FLAG_SLASH_RATE)),
  );

  return { tier, score, slashRate: rate, reasons, warnings };
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

export const TIER_LABEL: Record<TrustTier, string> = {
  verified: "Verified",
  community: "Community",
  flagged: "Flagged",
};

export const TIER_BLURB: Record<TrustTier, string> = {
  verified:
    "Curated, verified predicate, long history, low slash rate. Still not a guarantee.",
  community: "Permissionless. Read the predicate yourself before bonding.",
  flagged: "High slash rate or net-negative keeper P&L. Bond at your own risk.",
};
