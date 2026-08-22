"use client";

import * as React from "react";
import {
  Ban,
  Coins,
  FilePlus2,
  Flag,
  Hand,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMon } from "@/lib/gas";
import type { CoordinatorEvent, CoordinatorEventKind } from "@/types/truce";
import { AddressLink } from "./Mono";

const KIND: Record<
  CoordinatorEventKind,
  { icon: React.ElementType; tone: string; label: string }
> = {
  Claimed: { icon: Hand, tone: "text-warn", label: "Claimed" },
  Consumed: { icon: Zap, tone: "text-ok", label: "Consumed" },
  Resolved: { icon: ShieldCheck, tone: "text-muted", label: "Released" },
  TaskRegistered: { icon: FilePlus2, tone: "text-accent", label: "Registered" },
  TaskFunded: { icon: Coins, tone: "text-accent", label: "Funded" },
  TaskDeactivated: { icon: Ban, tone: "text-muted", label: "Deactivated" },
  TaskFundsWithdrawn: { icon: Coins, tone: "text-muted", label: "Funds withdrawn" },
  Withdrawal: { icon: Coins, tone: "text-muted", label: "Withdrawal" },
};

export function EventFeed({
  events,
  showTask = false,
  className,
}: {
  events: CoordinatorEvent[];
  showTask?: boolean;
  className?: string;
}) {
  return (
    <ul className={cn("divide-y divide-line", className)}>
      {events.map((e) => {
        const slashed = e.kind === "Resolved" && e.slashed;
        const meta = KIND[e.kind];
        const Icon = slashed ? Flag : meta.icon;

        return (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <Icon
              className={cn("mt-[2px] size-3.5 shrink-0", slashed ? "text-bad" : meta.tone)}
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span
                  className={cn(
                    "font-mono text-[11px] font-semibold uppercase tracking-[0.14em]",
                    slashed ? "text-bad" : meta.tone,
                  )}
                >
                  {slashed ? "Slashed" : meta.label}
                </span>
                {e.keeper ? <AddressLink address={e.keeper} copyable={false} /> : null}
                {e.amountWei !== undefined ? (
                  <span className="font-mono text-[12px] text-fg" data-numeric>
                    {formatMon(e.amountWei)} MON
                  </span>
                ) : null}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-faint">
                {e.subject ? (
                  <span className="font-mono">subject {e.subject.slice(0, 10)}…</span>
                ) : null}
                {e.expiryBlock ? (
                  <span className="font-mono" data-numeric>
                    expires #{e.expiryBlock.toLocaleString("en-US")}
                  </span>
                ) : null}
                {showTask ? <span className="font-mono">{e.taskId.slice(0, 10)}…</span> : null}
              </div>

              {e.kind === "Resolved" ? (
                <div
                  className={cn(
                    "mt-2 rounded-[5px] border px-2.5 py-1.5 text-[11.5px]",
                    slashed
                      ? "border-bad/35 bg-bad-soft text-bad"
                      : "border-line bg-surface text-muted",
                  )}
                >
                  {slashed
                    ? `Predicate still true at expiry — the work was never done. Bond slashed; ${e.resolver ? "resolver" : "the caller"} took SLASH_REWARD.`
                    : "Predicate false at expiry — someone else did the work, so the bond was released in full."}
                </div>
              ) : null}
            </div>

            <span className="shrink-0 font-mono text-[11px] text-faint" data-numeric>
              #{e.blockNumber.toLocaleString("en-US")}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
