"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Lock, Unlock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/gas";
import { MONAD_TESTNET } from "@/lib/chain";
import { assessTrust } from "@/lib/trust";
import type { Task } from "@/types/truce";
import { MonValue } from "@/components/instrument/MonValue";
import { TrustBadge } from "@/components/instrument/TrustBadge";
import { Hash } from "@/components/instrument/Mono";

const CATEGORY_LABEL: Record<Task["category"], string> = {
  liquidation: "liquidation",
  "dex-arb": "dex-arb",
  cron: "cron",
};

export function TaskCard({ task }: { task: Task }) {
  const trust = assessTrust(task);
  const live = task.eligibleSubjects > 0;

  return (
    <Link
      href={`/tasks/${task.taskId}`}
      className="group relative flex flex-col rounded-[10px] border border-line bg-panel transition-colors hover:border-line-strong"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3.5">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="label-micro">{CATEGORY_LABEL[task.category]}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[0.12em]",
                task.enforced ? "text-ok" : "text-faint",
              )}
              title={
                task.enforced
                  ? "The protocol requires holder(taskId, subject) == msg.sender"
                  : "Voluntary — a keeper can ignore the registry on this task"
              }
            >
              {task.enforced ? <Lock className="size-2.5" /> : <Unlock className="size-2.5" />}
              {task.enforced ? "enforced" : "voluntary"}
            </span>
          </div>
          <h3 className="mt-1.5 truncate text-[14.5px] font-semibold tracking-[-0.01em] text-fg">
            {task.label}
          </h3>
        </div>
        <TrustBadge tier={trust.tier} size="sm" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-3.5 px-4 py-4">
        <Cell label="bond">
          <MonValue wei={task.params.bondWei} size="sm" />
        </Cell>
        <Cell label="bounty">
          {task.params.bountyPerJob > 0n ? (
            <MonValue wei={task.params.bountyPerJob} size="sm" tone="ok" />
          ) : (
            <span className="font-mono text-[11.5px] text-faint">self-funding MEV</span>
          )}
        </Cell>
        <Cell label="window">
          <span className="font-mono text-[11.5px] text-fg" data-numeric>
            {task.params.windowBlocks} blk
            <span className="ml-1.5 text-faint">
              ≈ {formatDuration(task.params.windowBlocks * MONAD_TESTNET.blockMs)}
            </span>
          </span>
        </Cell>
        <Cell label="escrow">
          {task.escrowWei > 0n ? (
            <MonValue wei={task.escrowWei} size="sm" />
          ) : (
            <span className="font-mono text-[11.5px] text-faint">none</span>
          )}
        </Cell>
      </div>

      <div className="mt-auto flex items-center gap-4 border-t border-line px-4 py-3">
        <Meter
          label="slash rate"
          value={`${(trust.slashRate * 100).toFixed(1)}%`}
          fraction={Math.min(1, trust.slashRate / 0.2)}
          tone={trust.slashRate >= 0.2 ? "bad" : trust.slashRate > 0.05 ? "warn" : "ok"}
        />
        <span className="ml-auto flex items-center gap-2">
          {live ? (
            <span className="inline-flex items-center gap-1.5 rounded-[4px] border border-bad/40 bg-bad/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.1em] text-bad">
              <span className="size-1.5 animate-[truce-pulse_1.4s_ease-in-out_infinite] rounded-full bg-bad" />
              {task.eligibleSubjects} eligible
            </span>
          ) : (
            <span className="font-mono text-[10.5px] uppercase tracking-[0.1em] text-faint">
              idle
            </span>
          )}
          <ArrowUpRight className="size-3.5 text-faint transition-colors group-hover:text-accent" />
        </span>
      </div>

      <div className="border-t border-line px-4 py-2.5">
        <Hash value={task.taskId} head={10} tail={6} copyable={false} />
      </div>
    </Link>
  );
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="label-micro">{label}</div>
      <div className="mt-1 truncate">{children}</div>
    </div>
  );
}

function Meter({
  label,
  value,
  fraction,
  tone,
}: {
  label: string;
  value: string;
  fraction: number;
  tone: "ok" | "warn" | "bad";
}) {
  return (
    <div className="min-w-[104px]">
      <div className="flex items-baseline justify-between gap-2">
        <span className="label-micro">{label}</span>
        <span className="font-mono text-[11px] text-muted" data-numeric>
          {value}
        </span>
      </div>
      <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "ok" && "bg-ok",
            tone === "warn" && "bg-warn",
            tone === "bad" && "bg-bad",
          )}
          style={{ width: `${Math.max(3, fraction * 100)}%` }}
        />
      </div>
    </div>
  );
}
