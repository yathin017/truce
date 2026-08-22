"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Copy, Loader2, Terminal, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGasExact, formatMon } from "@/lib/gas";
import {
  CLAIM_GAS_LIMIT,
  MONAD_TESTNET,
  PERFORM_GAS_LIMIT,
} from "@/lib/chain";
import { addressFromSubject } from "@/lib/encoding";
import {
  DEPLOYMENT,
  HEAD_BLOCK,
  collect,
  getKeeperSnapshot,
  getRecentEvents,
  listTasks,
} from "@/services/truce";
import type {
  CoordinatorEvent,
  KeeperOutcome,
  KeeperSnapshot,
  SafetyLimits,
  Task,
} from "@/types/truce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonValue, Readout } from "@/components/instrument/MonValue";
import { AddressLink } from "@/components/instrument/Mono";
import { BlockCountdown } from "@/components/instrument/BlockCountdown";
import { StandDownIndicator, StandDownList } from "@/components/instrument/StandDown";
import { EventFeed } from "@/components/instrument/EventFeed";
import { EmptyRow, ScrollTable, Td, Th, Tr } from "@/components/instrument/Table";

const OUTCOME_ORDER: KeeperOutcome[] = [
  "won",
  "stood-down",
  "lost-race",
  "skipped",
  "ineligible",
  "dry-run",
];

const OUTCOME_TONE: Record<KeeperOutcome, string> = {
  won: "text-ok",
  "stood-down": "text-bad",
  "lost-race": "text-warn",
  skipped: "text-muted",
  ineligible: "text-faint",
  "dry-run": "text-accent",
};

export default function KeeperPage() {
  const [snap, setSnap] = React.useState<KeeperSnapshot | null>(null);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [events, setEvents] = React.useState<CoordinatorEvent[]>([]);
  const [block, setBlock] = React.useState(HEAD_BLOCK);
  const [mode, setMode] = React.useState<"managed" | "advanced">("managed");
  const [safety, setSafety] = React.useState<SafetyLimits | null>(null);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [executor, setExecutor] = React.useState("");
  const [collecting, setCollecting] = React.useState(false);

  React.useEffect(() => {
    getKeeperSnapshot().then((s) => {
      setSnap(s);
      setSafety(s.safety);
      setExecutor(s.executor);
    });
    listTasks().then((t) => {
      setTasks(t);
      setSelected(new Set(t.slice(0, 1).map((x) => x.taskId)));
    });
    getRecentEvents(8).then(setEvents);
  }, []);

  React.useEffect(() => {
    const id = window.setInterval(
      () => setBlock((b) => b + 1),
      MONAD_TESTNET.blockMs * 4,
    );
    return () => window.clearInterval(id);
  }, []);

  if (!snap || !safety) {
    return <div className="px-4 py-7 text-[13px] text-faint lg:px-7">Reading keeper state…</div>;
  }

  const set = <K extends keyof SafetyLimits>(key: K, value: SafetyLimits[K]) =>
    setSafety((s) => (s ? { ...s, [key]: value } : s));

  const chosen = tasks.filter((t) => selected.has(t.taskId));
  const gasAvoided = snap.standDowns.reduce((a, r) => a + r.gasAvoided, 0);

  return (
    <div className="px-4 py-7 lg:px-7">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
        <div>
          <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">Keeper</h1>
          <p className="mt-1.5 max-w-[66ch] text-[13.5px] leading-relaxed text-muted">
            Claim cheap, execute once. The daemon polls every subject, claims only
            what is eligible and unheld, and stands down the moment a rival holds
            the rights.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden items-baseline gap-2 sm:flex">
            <span className="label-micro">operator</span>
            <AddressLink address={snap.operator} />
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={snap.withdrawableWei === 0n || collecting}
            onClick={async () => {
              setCollecting(true);
              await collect();
              setCollecting(false);
            }}
          >
            {collecting ? <Loader2 className="animate-spin" /> : <Wallet />}
            collect {formatMon(snap.withdrawableWei, 3)} MON
          </Button>
        </div>
      </header>

      {/* Stand-down — the product working */}
      <StandDownIndicator
        className="mt-6"
        count={snap.standDowns.length}
        gasAvoided={gasAvoided}
      />

      {/* Live meters */}
      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Meter label="bond at risk" hint="locked in live claims">
          <MonValue wei={snap.bondAtRiskWei} size="lg" />
        </Meter>
        <Meter
          label="exposure today"
          hint={`cap ${safety.maxDailyBondExposure} MON`}
        >
          <MonValue wei={snap.todayExposureWei} size="lg" />
          <ExposureBar
            usedWei={snap.todayExposureWei}
            capMon={safety.maxDailyBondExposure}
          />
        </Meter>
        <Meter label="withdrawable" hint="pull payment on the coordinator">
          <MonValue wei={snap.withdrawableWei} size="lg" tone="ok" />
        </Meter>
        <Meter
          label="realised P&L"
          hint={`+${formatMon(snap.bountiesEarnedWei, 3)} bounties · −${formatMon(snap.bondsSlashedWei, 3)} slashed`}
        >
          <MonValue wei={snap.realisedPnlWei} size="lg" tone="auto" signed />
        </Meter>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="min-w-0 space-y-5">
          {/* Active claims */}
          <section>
            <SectionHead title="Active claims" note="getClaim(taskId, subject)" />
            <ScrollTable className="mt-2.5">
              <thead>
                <tr>
                  <Th>task</Th>
                  <Th>subject</Th>
                  <Th>bond</Th>
                  <Th>bounty</Th>
                  <Th>window left</Th>
                  <Th align="right">status</Th>
                </tr>
              </thead>
              <tbody>
                {snap.activeClaims.length === 0 ? (
                  <EmptyRow colSpan={6}>
                    No live claims. The daemon is polling.
                  </EmptyRow>
                ) : (
                  snap.activeClaims.map((c) => (
                    <Tr key={`${c.taskId}-${c.subject}`} highlight="accent">
                      <Td>
                        <Link
                          href={`/tasks/${c.taskId}`}
                          className="text-[12.5px] text-fg hover:text-accent"
                        >
                          {c.taskLabel}
                        </Link>
                      </Td>
                      <Td>
                        <div className="font-mono text-[12px] text-fg">{c.subjectLabel}</div>
                        <div className="mt-0.5">
                          <AddressLink
                            address={addressFromSubject(c.subject)}
                            copyable={false}
                          />
                        </div>
                      </Td>
                      <Td>
                        <MonValue wei={c.bondWei} size="sm" />
                      </Td>
                      <Td>
                        {c.bountyWei > 0n ? (
                          <MonValue wei={c.bountyWei} size="sm" tone="ok" />
                        ) : (
                          <span className="font-mono text-[11.5px] text-faint">MEV</span>
                        )}
                      </Td>
                      <Td>
                        <BlockCountdown
                          expiryBlock={c.expiryBlock}
                          currentBlock={block}
                          windowBlocks={3}
                        />
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-accent">
                          {c.status}
                        </span>
                      </Td>
                    </Tr>
                  ))
                )}
              </tbody>
            </ScrollTable>
          </section>

          {/* Outcomes */}
          <section className="rounded-[9px] border border-line bg-panel">
            <SectionHead title="Poll outcomes" note="keeper/src/keeper.ts Outcome" boxed />
            <div className="grid grid-cols-3 gap-x-6 gap-y-4 px-4 py-4 sm:grid-cols-6">
              {OUTCOME_ORDER.map((o) => (
                <div key={o}>
                  <div className="label-micro">{o}</div>
                  <div
                    className={cn(
                      "mt-1 font-mono text-[19px] tracking-[-0.01em]",
                      snap.outcomes[o] > 0 ? OUTCOME_TONE[o] : "text-faint",
                    )}
                    data-numeric
                  >
                    {snap.outcomes[o]}
                  </div>
                </div>
              ))}
            </div>
            {snap.standDowns.length > 0 ? (
              <div className="border-t border-line px-4 py-2">
                <StandDownList records={snap.standDowns} />
              </div>
            ) : null}
          </section>

          {/* Feed */}
          <section className="rounded-[9px] border border-line bg-panel">
            <SectionHead title="Coordinator feed" note="all tasks" boxed />
            <EventFeed events={events} showTask />
          </section>
        </div>

        {/* Config rail */}
        <aside className="space-y-5">
          <section className="rounded-[9px] border border-line bg-panel">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">
                Configuration
              </h2>
              <span className="inline-flex rounded-[6px] border border-line bg-surface p-[2px]">
                {(["managed", "advanced"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMode(m)}
                    className={cn(
                      "rounded-[4px] px-2.5 py-1 font-mono text-[11px] transition-colors",
                      mode === m ? "bg-elevated text-fg" : "text-faint hover:text-muted",
                    )}
                  >
                    {m}
                  </button>
                ))}
              </span>
            </div>

            <div className="px-4 py-4">
              {mode === "advanced" ? (
                <div className="mb-4">
                  <div className="label-micro">executor address</div>
                  <Input
                    value={executor}
                    onChange={(e) => setExecutor(e.target.value)}
                    spellCheck={false}
                    className="mt-1.5 font-mono text-[12.5px]"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-faint">
                    Your own <code className="font-mono">BaseExecutor</code>. It must
                    hold the bond and assert{" "}
                    <code className="font-mono">holder(taskId, subject) == address(this)</code>{" "}
                    inside perform.
                  </p>
                </div>
              ) : (
                <p className="mb-4 text-[11.5px] leading-relaxed text-faint">
                  Managed mode uses the reference executor at{" "}
                  <span className="font-mono text-muted">
                    {snap.executor.slice(0, 10)}…
                  </span>
                  . Bonds are forwarded from your operator key; nothing custodial.
                </p>
              )}

              <div className="label-micro">safety limits</div>
              <div className="mt-2.5 space-y-3">
                <NumField
                  label="maxBondPerClaim"
                  unit="MON"
                  value={safety.maxBondPerClaim}
                  onChange={(v) => set("maxBondPerClaim", v)}
                />
                <NumField
                  label="maxDailyBondExposure"
                  unit="MON"
                  value={safety.maxDailyBondExposure}
                  onChange={(v) => set("maxDailyBondExposure", v)}
                />
                <NumField
                  label="maxConcurrentClaims"
                  value={String(safety.maxConcurrentClaims)}
                  onChange={(v) => set("maxConcurrentClaims", Number(v) || 0)}
                />
                <NumField
                  label="minTaskAgeBlocks"
                  value={String(safety.minTaskAgeBlocks)}
                  onChange={(v) => set("minTaskAgeBlocks", Number(v) || 0)}
                />
                <NumField
                  label="maxTaskSlashRate"
                  unit={`${(safety.maxTaskSlashRate * 100).toFixed(0)}%`}
                  value={String(safety.maxTaskSlashRate)}
                  onChange={(v) => set("maxTaskSlashRate", Number(v) || 0)}
                />
                <NumField
                  label="requireStableEligible"
                  unit="polls"
                  value={String(safety.requireStableEligible)}
                  onChange={(v) => set("requireStableEligible", Number(v) || 0)}
                />
                <SwitchField
                  label="onlyVerifiedTasks"
                  value={safety.onlyVerifiedTasks}
                  onChange={(v) => set("onlyVerifiedTasks", v)}
                />
                <SwitchField
                  label="dryRun"
                  hint="log decisions, never send"
                  value={safety.dryRun}
                  onChange={(v) => set("dryRun", v)}
                />
              </div>

              <div className="mt-5 label-micro">tasks</div>
              <div className="mt-2 space-y-1.5">
                {tasks.map((t) => (
                  <label
                    key={t.taskId}
                    className="flex cursor-pointer items-center gap-2.5 rounded-[5px] px-1 py-1 hover:bg-surface"
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(t.taskId)}
                      onChange={(e) =>
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(t.taskId);
                          else next.delete(t.taskId);
                          return next;
                        })
                      }
                      className="size-3.5 accent-[var(--accent)]"
                    />
                    <span className="truncate text-[12.5px] text-fg">{t.label}</span>
                    <span className="ml-auto font-mono text-[11px] text-faint">
                      {formatMon(t.params.bondWei, 3)}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </section>

          <YamlPanel
            safety={safety}
            executor={mode === "advanced" ? executor : snap.executor}
            label={snap.label}
            tasks={chosen}
          />
        </aside>
      </div>
    </div>
  );
}

function YamlPanel({
  safety,
  executor,
  label,
  tasks,
}: {
  safety: SafetyLimits;
  executor: string;
  label: string;
  tasks: Task[];
}) {
  const [copied, setCopied] = React.useState(false);

  const yaml = `rpc: "${MONAD_TESTNET.rpcUrl}"
chainId: ${MONAD_TESTNET.id}
account: "\${KEEPER_PRIVATE_KEY}"
coordinator: "${DEPLOYMENT.coordinator}"
executor: "${executor}"
label: "${label}"
pollIntervalMs: 400

safety:
  maxBondPerClaim: "${safety.maxBondPerClaim}"
  maxConcurrentClaims: ${safety.maxConcurrentClaims}
  maxDailyBondExposure: "${safety.maxDailyBondExposure}"
  onlyVerifiedTasks: ${safety.onlyVerifiedTasks}
  minTaskAgeBlocks: ${safety.minTaskAgeBlocks}
  maxTaskSlashRate: ${safety.maxTaskSlashRate}
  requireStableEligible: ${safety.requireStableEligible}
  dryRun: ${safety.dryRun}

tasks:
${
  tasks.length === 0
    ? "  []"
    : tasks
        .map(
          (t) => `  # ${t.label}
  - taskId: "${t.taskId}"
    subjects: []
    claimGasLimit: ${CLAIM_GAS_LIMIT}
    performGasLimit: ${PERFORM_GAS_LIMIT}
    payload: "0x"`,
        )
        .join("\n")
}`;

  return (
    <section className="rounded-[9px] border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">keeper.yml</h2>
        <button
          onClick={() => {
            navigator.clipboard.writeText(yaml).then(
              () => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1_200);
              },
              () => undefined,
            );
          }}
          className="text-faint transition-colors hover:text-fg"
          aria-label="Copy config"
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="table-scroll max-h-[420px] overflow-y-auto px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
        {yaml}
      </pre>
      <div className="border-t border-line px-4 py-3">
        <div className="flex items-center gap-2">
          <Terminal className="size-3.5 text-faint" />
          <span className="label-micro">run it</span>
        </div>
        <pre className="table-scroll mt-2 rounded-[6px] border border-line bg-surface px-3 py-2 font-mono text-[11px] text-fg">
          pnpm --filter keeper dev run --config keeper.yml
        </pre>
        <p className="mt-2 text-[11px] leading-relaxed text-faint">
          Each claim declares {formatGasExact(CLAIM_GAS_LIMIT)} gas — keep it tight,
          you are billed the limit whether or not you win.
        </p>
      </div>
    </section>
  );
}

function ExposureBar({ usedWei, capMon }: { usedWei: bigint; capMon: string }) {
  const cap = Number(capMon) || 0;
  const used = Number(usedWei) / 1e18;
  const pct = cap > 0 ? Math.min(1, used / cap) : 0;
  return (
    <div className="tick-rule-fine mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface">
      <div
        className={cn(
          "h-full rounded-full",
          pct > 0.85 ? "bg-bad" : pct > 0.6 ? "bg-warn" : "bg-accent",
        )}
        style={{ width: `${pct * 100}%` }}
      />
    </div>
  );
}

function Meter({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[9px] border border-line bg-panel px-4 py-3.5">
      <Readout label={label} hint={hint}>
        {children}
      </Readout>
    </div>
  );
}

function SectionHead({
  title,
  note,
  boxed,
}: {
  title: string;
  note?: string;
  boxed?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
        boxed && "border-b border-line px-4 py-3",
      )}
    >
      <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
      {note ? <span className="font-mono text-[11px] text-faint">{note}</span> : null}
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-muted">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-8 w-24 text-right font-mono text-[12px]"
      />
      {unit ? (
        <span className="w-10 shrink-0 font-mono text-[10.5px] text-faint">{unit}</span>
      ) : (
        <span className="w-10 shrink-0" />
      )}
    </div>
  );
}

function SwitchField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[11.5px] text-muted">{label}</span>
        {hint ? <span className="block text-[10.5px] text-faint">{hint}</span> : null}
      </span>
      <button
        onClick={() => onChange(!value)}
        aria-pressed={value}
        className={cn(
          "h-5 w-9 shrink-0 rounded-full border transition-colors",
          value ? "border-accent/60 bg-accent/25" : "border-line-strong bg-surface",
        )}
      >
        <span
          className={cn(
            "block size-3.5 rounded-full transition-transform",
            value ? "translate-x-[18px] bg-accent" : "translate-x-[2px] bg-faint",
          )}
        />
      </button>
      <span className="w-10 shrink-0" />
    </div>
  );
}
