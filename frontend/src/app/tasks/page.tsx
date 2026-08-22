"use client";

import * as React from "react";
import Link from "next/link";
import { Filter, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMon } from "@/lib/gas";
import { DEFAULT_BOND_WEI } from "@/lib/chain";
import { assessTrust } from "@/lib/trust";
import { listTasks, DEPLOYMENT } from "@/services/truce";
import type { Category, Task } from "@/types/truce";
import { TaskCard } from "@/components/tasks/TaskCard";
import { Button } from "@/components/ui/button";
import { Hash } from "@/components/instrument/Mono";

const CATEGORIES: { id: Category | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "liquidation", label: "Liquidation" },
  { id: "dex-arb", label: "DEX arb" },
  { id: "cron", label: "Cron" },
];

const BOND_CAPS = [
  { label: "any", wei: null },
  { label: "≤ 0.01", wei: DEFAULT_BOND_WEI },
  { label: "≤ 0.1", wei: DEFAULT_BOND_WEI * 10n },
];

const SLASH_CAPS = [
  { label: "any", rate: 1 },
  { label: "≤ 10%", rate: 0.1 },
  { label: "≤ 5%", rate: 0.05 },
];

export default function TasksPage() {
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [category, setCategory] = React.useState<Category | "all">("all");
  const [verifiedOnly, setVerifiedOnly] = React.useState(true);
  const [bountyOnly, setBountyOnly] = React.useState(false);
  const [bondCap, setBondCap] = React.useState(0);
  const [slashCap, setSlashCap] = React.useState(0);

  React.useEffect(() => {
    listTasks().then(setTasks);
  }, []);

  const filtered = React.useMemo(() => {
    if (!tasks) return [];
    return tasks.filter((t) => {
      if (category !== "all" && t.category !== category) return false;
      const trust = assessTrust(t);
      if (verifiedOnly && trust.tier !== "verified") return false;
      if (bountyOnly && t.params.bountyPerJob <= 0n) return false;
      const cap = BOND_CAPS[bondCap].wei;
      if (cap !== null && t.params.bondWei > cap) return false;
      if (trust.slashRate > SLASH_CAPS[slashCap].rate) return false;
      return true;
    });
  }, [tasks, category, verifiedOnly, bountyOnly, bondCap, slashCap]);

  const hiddenByTrust = React.useMemo(() => {
    if (!tasks || !verifiedOnly) return 0;
    return tasks.filter((t) => assessTrust(t).tier !== "verified").length;
  }, [tasks, verifiedOnly]);

  return (
    <div className="px-4 py-7 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Tasks</h1>
          <p className="mt-1.5 max-w-[62ch] text-[13.5px] leading-relaxed text-muted">
            Every task is an immutable tuple registered on the coordinator. Bond a
            claim, hold exclusive rights for the window, do the work — or get
            slashed for holding rights you never used.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-baseline gap-2 sm:flex">
            <span className="label-micro">coordinator</span>
            <Hash value={DEPLOYMENT.coordinator} head={8} tail={6} />
          </span>
          <Button asChild variant="primary" size="sm">
            <Link href="/register">
              <Plus />
              Register task
            </Link>
          </Button>
        </div>
      </header>

      {/* Filter bench */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[9px] border border-line bg-panel px-4 py-3">
        <span className="flex items-center gap-2 text-faint">
          <Filter className="size-3.5" />
          <span className="label-micro">filters</span>
        </span>

        <Segmented
          options={CATEGORIES.map((c) => c.label)}
          index={CATEGORIES.findIndex((c) => c.id === category)}
          onChange={(i) => setCategory(CATEGORIES[i].id)}
        />

        <FilterGroup label="max bond">
          <Segmented
            options={BOND_CAPS.map((b) => b.label)}
            index={bondCap}
            onChange={setBondCap}
          />
        </FilterGroup>

        <FilterGroup label="max slash rate">
          <Segmented
            options={SLASH_CAPS.map((s) => s.label)}
            index={slashCap}
            onChange={setSlashCap}
          />
        </FilterGroup>

        <Toggle
          active={bountyOnly}
          onClick={() => setBountyOnly((v) => !v)}
          label="Bounty > 0"
        />

        <Toggle
          active={verifiedOnly}
          onClick={() => setVerifiedOnly((v) => !v)}
          label="Verified only"
          icon={ShieldCheck}
          tone="ok"
          className="ml-auto"
        />
      </div>

      {verifiedOnly && hiddenByTrust > 0 ? (
        <p className="mt-3 text-[12px] text-faint">
          {hiddenByTrust} task{hiddenByTrust === 1 ? "" : "s"} hidden by the
          curated filter. Tiers are computed in this frontend — the coordinator
          is permissionless and does not enforce them.
        </p>
      ) : null}

      {/* Grid */}
      {tasks === null ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[268px] animate-pulse rounded-[10px] border border-line bg-panel"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-6 rounded-[10px] border border-dashed border-line-strong bg-panel px-6 py-16 text-center">
          <p className="text-[14px] text-fg">No task matches these filters.</p>
          <p className="mt-1.5 text-[12.5px] text-faint">
            Loosen the bond cap or turn off &ldquo;Verified only&rdquo;.
          </p>
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((task) => (
            <TaskCard key={task.taskId} task={task} />
          ))}
        </div>
      )}

      {/* Aggregate strip */}
      {tasks ? <Totals tasks={filtered} /> : null}
    </div>
  );
}

function Totals({ tasks }: { tasks: Task[] }) {
  const claims = tasks.reduce((a, t) => a + t.stats.claims, 0);
  const slashed = tasks.reduce((a, t) => a + t.stats.slashed, 0);
  const escrow = tasks.reduce((a, t) => a + t.escrowWei, 0n);
  const eligible = tasks.reduce((a, t) => a + t.eligibleSubjects, 0);

  return (
    <div className="mt-6 flex flex-wrap items-baseline gap-x-10 gap-y-3 border-t border-line pt-4">
      <Total label="tasks shown" value={String(tasks.length)} />
      <Total label="claims settled" value={claims.toLocaleString("en-US")} />
      <Total
        label="slashed"
        value={slashed.toLocaleString("en-US")}
        tone={slashed > 0 ? "bad" : undefined}
      />
      <Total label="escrow held" value={`${formatMon(escrow)} MON`} />
      <Total
        label="eligible now"
        value={String(eligible)}
        tone={eligible > 0 ? "bad" : undefined}
      />
    </div>
  );
}

function Total({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "bad";
}) {
  return (
    <span className="flex items-baseline gap-2.5">
      <span className="label-micro">{label}</span>
      <span
        className={cn("font-mono text-[13px]", tone === "bad" ? "text-bad" : "text-fg")}
        data-numeric
      >
        {value}
      </span>
    </span>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <span className="flex items-center gap-2.5">
      <span className="label-micro">{label}</span>
      {children}
    </span>
  );
}

function Segmented({
  options,
  index,
  onChange,
}: {
  options: string[];
  index: number;
  onChange: (i: number) => void;
}) {
  return (
    <span className="inline-flex rounded-[6px] border border-line bg-surface p-[2px]">
      {options.map((opt, i) => (
        <button
          key={opt}
          onClick={() => onChange(i)}
          className={cn(
            "rounded-[4px] px-2.5 py-1 font-mono text-[11px] transition-colors",
            i === index
              ? "bg-elevated text-fg shadow-[var(--shadow-panel)]"
              : "text-faint hover:text-muted",
          )}
        >
          {opt}
        </button>
      ))}
    </span>
  );
}

function Toggle({
  active,
  onClick,
  label,
  icon: Icon,
  tone,
  className,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: React.ElementType;
  tone?: "ok";
  className?: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-[6px] border px-2.5 py-1.5 font-mono text-[11px] transition-colors",
        active
          ? tone === "ok"
            ? "border-ok/45 bg-ok/12 text-ok"
            : "border-accent/45 bg-accent-soft text-accent"
          : "border-line bg-surface text-faint hover:text-muted",
        className,
      )}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      {label}
      <span
        className={cn(
          "ml-0.5 inline-block h-3 w-5 rounded-full border transition-colors",
          active ? "border-current bg-current/25" : "border-line-strong",
        )}
      >
        <span
          className={cn(
            "block size-2 translate-y-[1.5px] rounded-full transition-transform",
            active ? "translate-x-[10px] bg-current" : "translate-x-[2px] bg-faint",
          )}
        />
      </span>
    </button>
  );
}
