"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BASE_FEE_WEI } from "@/lib/chain";
import { declaredExposureWei, formatGas, formatGasExact, formatMon } from "@/lib/gas";

export interface GasBarRow {
  label: string;
  gas: number;
  /** Portion of `gas` that produced real work — drawn solid, rest hatched. */
  usefulGas?: number;
  tone?: "bad" | "ok" | "accent" | "neutral";
  note?: string;
}

const FILL: Record<NonNullable<GasBarRow["tone"]>, string> = {
  bad: "bg-bad",
  ok: "bg-ok",
  accent: "bg-accent",
  neutral: "bg-line-strong",
};

/**
 * Horizontal gas comparison, drawn against a ruled scale so the reader is
 * measuring rather than vibing. Bars are always scaled to the largest row
 * in the set — never re-normalised per bar.
 */
export function GasBars({
  rows,
  baseFeeWei = BASE_FEE_WEI,
  showMon = true,
  className,
}: {
  rows: GasBarRow[];
  baseFeeWei?: bigint;
  showMon?: boolean;
  className?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.gas));

  return (
    <div className={cn("space-y-4", className)}>
      {rows.map((row) => {
        const tone = row.tone ?? "neutral";
        const pct = (row.gas / max) * 100;
        const usefulPct = row.usefulGas ? (row.usefulGas / max) * 100 : 0;

        return (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="text-[12.5px] font-medium text-fg">{row.label}</span>
              <span className="flex items-baseline gap-2.5">
                <span className="font-mono text-[13px] text-fg" data-numeric>
                  {formatGasExact(row.gas)}
                </span>
                {showMon ? (
                  <span className="font-mono text-[11.5px] text-faint" data-numeric>
                    {formatMon(declaredExposureWei(row.gas, baseFeeWei), 4)} MON
                  </span>
                ) : null}
              </span>
            </div>

            <div className="relative mt-2 h-6 overflow-hidden rounded-[3px] bg-surface">
              <div className="tick-rule-fine absolute inset-0 opacity-60" />
              <div
                className={cn(
                  "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                  FILL[tone],
                  "opacity-25",
                )}
                style={{ width: `${pct}%` }}
              />
              {row.usefulGas ? (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 transition-[width] duration-700 ease-out",
                    FILL[tone],
                  )}
                  style={{ width: `${usefulPct}%` }}
                />
              ) : (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 w-[2px] transition-[left] duration-700 ease-out",
                    FILL[tone],
                  )}
                  style={{ left: `calc(${pct}% - 2px)` }}
                />
              )}
            </div>

            <div className="mt-1.5 flex items-baseline justify-between gap-4">
              <span className="text-[11.5px] text-faint">{row.note}</span>
              {row.usefulGas ? (
                <span className="font-mono text-[11px] text-faint" data-numeric>
                  {formatGas(row.usefulGas)} useful ·{" "}
                  {((row.usefulGas / row.gas) * 100).toFixed(1)}%
                </span>
              ) : null}
            </div>
          </div>
        );
      })}

      <ScaleRule max={max} />
    </div>
  );
}

function ScaleRule({ max }: { max: number }) {
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  return (
    <div className="pt-1">
      <div className="tick-rule h-1.5 w-full opacity-50" />
      <div className="mt-1 flex justify-between">
        {ticks.map((t) => (
          <span key={t} className="font-mono text-[10px] text-faint" data-numeric>
            {formatGas(Math.round(max * t))}
          </span>
        ))}
      </div>
    </div>
  );
}
