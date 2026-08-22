import * as React from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "accent" | "ok" | "warn" | "bad";

const TONE: Record<Tone, { chip: string; dot: string }> = {
  neutral: { chip: "border-line-strong bg-elevated text-muted", dot: "bg-faint" },
  accent: { chip: "border-accent/35 bg-accent/10 text-accent-hi", dot: "bg-accent" },
  ok: { chip: "border-ok/30 bg-ok/10 text-ok", dot: "bg-ok" },
  warn: { chip: "border-warn/30 bg-warn/10 text-warn", dot: "bg-warn" },
  bad: { chip: "border-bad/30 bg-bad/10 text-bad", dot: "bg-bad" },
};

/** Maps domain statuses to a tone so colour usage stays consistent app-wide. */
export function toneForStatus(status: string): Tone {
  switch (status.toUpperCase()) {
    case "ACTIVE":
    case "SUCCESS":
    case "WON":
    case "SETTLED":
    case "CLAIM WINNER":
    case "CLAIM_WON":
    case "HEALTHY":
      return "ok";
    case "OPEN":
    case "PENDING":
    case "CLAIMED":
    case "EXECUTING":
      return "warn";
    case "FAILED":
    case "SLASHED":
    case "EXPIRED":
    case "LIQUIDATABLE":
      return "bad";
    case "PAUSED":
    case "LOST":
    case "AVOIDED":
    case "CLAIM_LOST":
      return "neutral";
    default:
      return "neutral";
  }
}

export function StatusBadge({
  status,
  tone,
  dot = true,
  pulse = false,
  className,
}: {
  status: string;
  tone?: Tone;
  dot?: boolean;
  pulse?: boolean;
  className?: string;
}) {
  const t = TONE[tone ?? toneForStatus(status)];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.1em]",
        t.chip,
        className,
      )}
    >
      {dot && (
        <span
          className={cn("size-1.5 rounded-full", t.dot)}
          style={pulse ? { animation: "truce-pulse 1.6s ease-in-out infinite" } : undefined}
        />
      )}
      {status}
    </span>
  );
}

export function StatusDot({
  tone = "ok",
  pulse = true,
  className,
}: {
  tone?: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("relative flex size-2", className)}>
      {pulse && (
        <span
          className={cn("absolute inline-flex size-full rounded-full opacity-60", TONE[tone].dot)}
          style={{ animation: "truce-pulse 1.8s ease-in-out infinite" }}
        />
      )}
      <span className={cn("relative inline-flex size-2 rounded-full", TONE[tone].dot)} />
    </span>
  );
}
