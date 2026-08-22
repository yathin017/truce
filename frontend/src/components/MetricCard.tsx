import * as React from "react";
import { cn } from "@/lib/utils";

export function MetricCard({
  label,
  value,
  unit,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: React.ReactNode;
  unit?: string;
  hint?: React.ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-[10px] border border-line bg-panel px-4 py-3.5 transition-colors hover:border-line-strong",
        className,
      )}
    >
      <div className="label-micro">{label}</div>
      <div className="mt-2.5 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-[26px] leading-none font-medium tracking-tight",
            accent ? "text-accent-hi" : "text-fg",
          )}
        >
          {value}
        </span>
        {unit ? (
          <span className="font-mono text-[13px] text-faint">{unit}</span>
        ) : null}
      </div>
      {hint ? <div className="mt-2 text-[11px] text-faint">{hint}</div> : null}
      <span
        aria-hidden
        className={cn(
          "absolute inset-x-0 bottom-0 h-px opacity-0 transition-opacity group-hover:opacity-100",
          accent ? "bg-accent/60" : "bg-line-strong",
        )}
      />
    </div>
  );
}

export function StatLine({
  label,
  value,
  mono = false,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  tone?: "ok" | "bad" | "warn" | "accent";
}) {
  const toneClass =
    tone === "ok"
      ? "text-ok"
      : tone === "bad"
        ? "text-bad"
        : tone === "warn"
          ? "text-warn"
          : tone === "accent"
            ? "text-accent-hi"
            : "text-fg";
  return (
    <div className="space-y-1.5">
      <div className="label-micro">{label}</div>
      <div className={cn("text-[15px] font-medium", mono && "font-mono", toneClass)}>
        {value}
      </div>
    </div>
  );
}
