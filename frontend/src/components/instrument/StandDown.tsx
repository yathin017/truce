"use client";

import * as React from "react";
import { Hand, OctagonX } from "lucide-react";
import { cn } from "@/lib/utils";
import { BASE_FEE_WEI } from "@/lib/chain";
import { declaredExposureWei, formatGasExact, formatMon } from "@/lib/gas";
import type { StandDownRecord } from "@/types/truce";
import { AddressLink } from "./Mono";

/**
 * The daemon saw work, saw a rival already holding rights, and did not send.
 * This indicator is the product working — it is deliberately impossible to miss.
 */
export function StandDownIndicator({
  count,
  gasAvoided,
  className,
}: {
  count: number;
  gasAvoided: number;
  className?: string;
}) {
  const idle = count === 0;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[10px] border p-5",
        idle ? "border-line bg-panel" : "border-bad/55 bg-bad-soft",
        className,
      )}
    >
      {!idle && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-bad/12 to-transparent"
          style={{ animation: "truce-sweep 3.2s ease-in-out infinite" }}
        />
      )}

      <div className="relative flex items-start gap-3.5">
        <span
          className={cn(
            "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-[7px] border",
            idle ? "border-line bg-surface text-faint" : "border-bad/50 bg-bad/15 text-bad",
          )}
        >
          {idle ? <Hand className="size-4" /> : <OctagonX className="size-4.5" />}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span
              className={cn(
                "font-mono text-[13px] font-semibold uppercase tracking-[0.16em]",
                idle ? "text-muted" : "text-bad",
              )}
            >
              {idle ? "No stand-downs" : "Stood down"}
            </span>
            {!idle && (
              <span
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-bad/80 animate-[truce-alarm_2s_ease-in-out_infinite]"
              >
                rights held elsewhere
              </span>
            )}
          </div>

          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
            {idle
              ? "Your keeper has not encountered a subject already claimed by a rival in this session."
              : `Your keeper found ${count} eligible ${count === 1 ? "subject" : "subjects"} already claimed by another keeper and did not send a transaction.`}
          </p>

          {!idle && (
            <div className="mt-3.5 flex flex-wrap items-end gap-x-8 gap-y-3">
              <Stat label="stand-downs" value={String(count)} />
              <Stat label="gas not declared" value={formatGasExact(gasAvoided)} />
              <Stat
                label="MON not spent"
                value={formatMon(declaredExposureWei(gasAvoided, BASE_FEE_WEI), 5)}
                tone="bad"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad";
}) {
  return (
    <div>
      <div className="label-micro">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-[17px] tracking-[-0.01em]",
          tone === "bad" ? "text-bad" : "text-fg",
        )}
        data-numeric
      >
        {value}
      </div>
    </div>
  );
}

export function StandDownList({
  records,
  className,
}: {
  records: StandDownRecord[];
  className?: string;
}) {
  if (records.length === 0) return null;

  return (
    <ul className={cn("divide-y divide-line", className)}>
      {records.map((r) => (
        <li key={r.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
          <span className="inline-flex size-1.5 shrink-0 rounded-full bg-bad" />
          <span className="font-mono text-[12px] text-fg">{r.subjectLabel}</span>
          <span className="text-[12px] text-muted">{r.taskLabel}</span>
          <span className="ml-auto flex items-center gap-3">
            <span className="text-[11.5px] text-faint">held by</span>
            <AddressLink address={r.holder} copyable={false} />
            <span className="font-mono text-[11.5px] text-faint" data-numeric>
              #{r.blockNumber.toLocaleString("en-US")}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
