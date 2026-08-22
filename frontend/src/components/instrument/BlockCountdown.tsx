"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { MONAD_TESTNET } from "@/lib/chain";
import { formatDuration } from "@/lib/gas";

/**
 * Windows are declared in blocks. Operators think in milliseconds.
 * This shows both, always, and drains a bar so the pressure is legible.
 */
export function BlockCountdown({
  expiryBlock,
  currentBlock,
  windowBlocks,
  blockMs = MONAD_TESTNET.blockMs,
  className,
}: {
  expiryBlock: number;
  currentBlock: number;
  windowBlocks: number;
  blockMs?: number;
  className?: string;
}) {
  const remaining = Math.max(0, expiryBlock - currentBlock);
  const pct = Math.max(0, Math.min(1, remaining / Math.max(1, windowBlocks)));
  const expired = remaining === 0;
  const urgent = remaining <= 1;

  return (
    <div className={cn("min-w-[112px]", className)}>
      <div className="flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-[13px]",
            expired ? "text-bad" : urgent ? "text-warn" : "text-fg",
          )}
          data-numeric
        >
          {expired ? "expired" : `${remaining} blk`}
        </span>
        {!expired && (
          <span className="font-mono text-[11px] text-faint" data-numeric>
            {formatDuration(remaining * blockMs)}
          </span>
        )}
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300 ease-linear",
            expired ? "bg-bad" : urgent ? "bg-warn" : "bg-accent",
          )}
          style={{ width: `${pct * 100}%` }}
        />
      </div>
    </div>
  );
}

/** "3 blocks ≈ 1.2s" — used wherever a window length is declared. */
export function WindowLabel({
  blocks,
  blockMs = MONAD_TESTNET.blockMs,
  className,
}: {
  blocks: number;
  blockMs?: number;
  className?: string;
}) {
  return (
    <span className={cn("font-mono text-[13px] text-fg", className)} data-numeric>
      {blocks} {blocks === 1 ? "block" : "blocks"}
      <span className="ml-1.5 text-faint">≈ {formatDuration(blocks * blockMs)}</span>
    </span>
  );
}
