"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { BASE_FEE_WEI } from "@/lib/chain";
import { declaredExposureWei, formatGasExact, formatMon } from "@/lib/gas";

/**
 * Every bond, bounty and escrow figure is shown in MON. No naked wei.
 */
export function MonValue({
  wei,
  digits = 4,
  tone = "default",
  size = "md",
  signed = false,
  className,
}: {
  wei: bigint;
  digits?: number;
  tone?: "default" | "muted" | "ok" | "bad" | "auto";
  size?: "sm" | "md" | "lg";
  signed?: boolean;
  className?: string;
}) {
  const resolved =
    tone === "auto" ? (wei < 0n ? "bad" : wei > 0n ? "ok" : "muted") : tone;

  const prefix = signed && wei > 0n ? "+" : "";

  return (
    <span
      data-numeric
      className={cn(
        "font-mono whitespace-nowrap",
        size === "sm" && "text-[11.5px]",
        size === "md" && "text-[13px]",
        size === "lg" && "text-[19px] tracking-[-0.01em]",
        resolved === "default" && "text-fg",
        resolved === "muted" && "text-muted",
        resolved === "ok" && "text-ok",
        resolved === "bad" && "text-bad",
        className,
      )}
    >
      {prefix}
      {formatMon(wei, digits)}
      <span className="ml-1 text-faint">MON</span>
    </span>
  );
}

/**
 * Gas is meaningless without a price. Every gas figure carries the MON it
 * costs at the current base fee — at the **declared limit**, which is what
 * Monad actually bills.
 */
export function GasValue({
  gas,
  baseFeeWei = BASE_FEE_WEI,
  label,
  className,
}: {
  gas: number;
  baseFeeWei?: bigint;
  label?: string;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span className="font-mono text-[13px] text-fg" data-numeric>
        {formatGasExact(gas)}
      </span>
      <span className="font-mono text-[11.5px] text-faint" data-numeric>
        = {formatMon(declaredExposureWei(gas, baseFeeWei), 5)} MON
        {label ? ` ${label}` : ""}
      </span>
    </span>
  );
}

/** Small label + value pair used across every panel. */
export function Readout({
  label,
  children,
  hint,
  className,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="label-micro">{label}</div>
      <div className="mt-1.5 truncate">{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}
