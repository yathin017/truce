"use client";

import * as React from "react";
import { AlertTriangle, Check, ShieldCheck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TIER_BLURB, TIER_LABEL, type TrustAssessment } from "@/lib/trust";
import type { TrustTier } from "@/types/truce";

const STYLE: Record<
  TrustTier,
  { chip: string; bar: string; icon: React.ElementType }
> = {
  verified: {
    chip: "border-ok/45 bg-ok/12 text-ok",
    bar: "bg-ok",
    icon: ShieldCheck,
  },
  community: {
    chip: "border-line-strong bg-elevated text-muted",
    bar: "bg-line-strong",
    icon: Users,
  },
  flagged: {
    chip: "border-bad/50 bg-bad/14 text-bad",
    bar: "bg-bad",
    icon: AlertTriangle,
  },
};

export function TrustBadge({
  tier,
  size = "md",
  className,
}: {
  tier: TrustTier;
  size?: "sm" | "md";
  className?: string;
}) {
  const s = STYLE[tier];
  const Icon = s.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[5px] border font-mono font-semibold uppercase tracking-[0.12em]",
        size === "sm" ? "px-1.5 py-[3px] text-[9.5px]" : "px-2 py-1 text-[10.5px]",
        s.chip,
        tier === "flagged" && "animate-[truce-alarm_2.4s_ease-in-out_infinite]",
        className,
      )}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} />
      {TIER_LABEL[tier]}
    </span>
  );
}

/** The badge is a claim; this is the evidence. Always render it on detail. */
export function TrustBreakdown({
  assessment,
  className,
}: {
  assessment: TrustAssessment;
  className?: string;
}) {
  const s = STYLE[assessment.tier];

  return (
    <div className={cn("rounded-[8px] border border-line bg-panel", className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <TrustBadge tier={assessment.tier} />
          <span className="text-[12.5px] text-muted">{TIER_BLURB[assessment.tier]}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="label-micro">score</span>
          <div className="tick-rule-fine relative h-2 flex-1 overflow-hidden rounded-full bg-surface">
            <div
              className={cn("absolute inset-y-0 left-0 rounded-full", s.bar)}
              style={{ width: `${Math.round(assessment.score * 100)}%` }}
            />
          </div>
          <span className="font-mono text-[12px] text-fg" data-numeric>
            {(assessment.score * 100).toFixed(0)}
          </span>
        </div>

        <ul className="mt-3.5 space-y-1.5">
          {assessment.reasons.map((r) => (
            <li key={r} className="flex items-start gap-2 text-[12.5px] text-muted">
              <Check className="mt-[2px] size-3.5 shrink-0 text-ok" />
              {r}
            </li>
          ))}
          {assessment.warnings.map((w) => (
            <li key={w} className="flex items-start gap-2 text-[12.5px] text-fg">
              <AlertTriangle className="mt-[2px] size-3.5 shrink-0 text-warn" />
              {w}
            </li>
          ))}
        </ul>

        <p className="mt-3.5 border-t border-line pt-3 text-[11.5px] leading-relaxed text-faint">
          Tiers are computed in this frontend from public on-chain statistics and a
          curated allowlist. The coordinator does not enforce them, and nothing here
          is an endorsement.
        </p>
      </div>
    </div>
  );
}
