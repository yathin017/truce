"use client";

import type { ArenaHandle } from "@/lib/arena";
import { LANE_META, LANE_ORDER, type ArenaState, type RoundRecord } from "@/lib/types";
import { mon, gwei, chainName } from "@/lib/format";

interface Agg {
  rounds: number;
  naiveBilled: bigint;
  coordBilled: bigint;
  naiveReserved: bigint;
  coordReserved: bigint;
  naiveUsed: bigint;
  coordUsed: bigint;
}

function aggregate(rounds: RoundRecord[]): Agg {
  const a: Agg = {
    rounds: rounds.length,
    naiveBilled: 0n,
    coordBilled: 0n,
    naiveReserved: 0n,
    coordReserved: 0n,
    naiveUsed: 0n,
    coordUsed: 0n,
  };
  for (const r of rounds) {
    a.naiveBilled += BigInt(r.naive.declaredWei);
    a.coordBilled += BigInt(r.coordinated.declaredWei);
    a.naiveReserved += BigInt(r.naive.gasReserved);
    a.coordReserved += BigInt(r.coordinated.gasReserved);
    for (const t of r.naive.txs) a.naiveUsed += BigInt(t.gasUsed);
    for (const t of r.coordinated.txs) a.coordUsed += BigInt(t.gasUsed);
  }
  return a;
}

function reduction(a: bigint, b: bigint): number {
  if (a === 0n) return 0;
  return Number(((a - b) * 10_000n) / a) / 100;
}

function ratioPct(used: bigint, reserved: bigint): number {
  if (reserved === 0n) return 0;
  return Number((used * 10_000n) / reserved) / 100;
}

export function Experiment({ arena }: { arena: ArenaHandle }) {
  const { state, connected, commandPending, commandError, fireAll } = arena;
  const rounds = state?.recentRounds ?? [];
  const agg = aggregate(rounds);
  const hasData = agg.rounds > 0;
  const busy = state?.busy ?? false;
  const running = busy || commandPending;
  const runningLane = state?.runningLane ?? null;
  const sampleStatus = !connected
    ? "arena offline"
    : running
      ? runningLane
        ? `Running ${LANE_ORDER.indexOf(runningLane) + 1}/${LANE_ORDER.length} · ${LANE_META[runningLane].short}`
        : "Preparing experiment…"
      : agg.rounds > 0
        ? `${agg.rounds} completed lane result${agg.rounds === 1 ? "" : "s"}`
        : "Ready · no transactions sent";

  return (
    <section className="wrap py-14 sm:py-20">
      <div className="max-w-2xl">
        <p className="eyebrow">The experiment</p>
        <h1 className="mt-3 text-[2.2rem] font-semibold leading-[1.05] tracking-tightest sm:text-[2.9rem]">
          The same job, run two ways, measured on-chain.
        </h1>
        <p className="mt-5 text-[16px] leading-relaxed text-ink-2">
          Four keeper bots compete for one opportunity. In the <strong className="font-semibold text-naive">naive</strong>{" "}
          round each fires the full-price execution directly — one lands, three revert, and on Monad
          all four are billed their declared limit. In the <strong className="font-semibold text-coord">coordinated</strong>{" "}
          round each fires a cheap claim first; one winner executes, the rest stood down. We measure
          what the chain actually bills.
        </p>
      </div>

      <SetupStrip state={state} />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button onClick={fireAll} disabled={!connected || busy || commandPending} className="btn btn-solid">
          {running ? "Experiment running…" : "Run the experiment"}
        </button>
        <span className="font-mono text-[11px] text-faint" aria-live="polite">{sampleStatus}</span>
        {commandError && <span className="font-mono text-[11px] text-naive">{commandError}</span>}
      </div>

      {hasData ? (
        <div className="mt-10 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <ComparisonBars
            title="MON billed"
            caption="declared-limit basis — what Monad actually charges"
            naiveLabel={mon(agg.naiveBilled, 4)}
            coordLabel={mon(agg.coordBilled, 4)}
            naive={Number(agg.naiveBilled)}
            coord={Number(agg.coordBilled)}
            reductionPct={reduction(agg.naiveBilled, agg.coordBilled)}
          />
          <ComparisonBars
            title="Block gas reserved"
            caption="capacity taken from the block, doing work or not"
            naiveLabel={agg.naiveReserved.toLocaleString()}
            coordLabel={agg.coordReserved.toLocaleString()}
            naive={Number(agg.naiveReserved)}
            coord={Number(agg.coordReserved)}
            reductionPct={reduction(agg.naiveReserved, agg.coordReserved)}
          />
          <UsefulWork
            naivePct={ratioPct(agg.naiveUsed, agg.naiveReserved)}
            coordPct={ratioPct(agg.coordUsed, agg.coordReserved)}
          />
        </div>
      ) : (
        <EmptyState connected={connected} running={running} />
      )}

      <Counterfactual />
      {hasData && <PerLane state={state} />}
    </section>
  );
}

function SetupStrip({ state }: { state: ArenaState | null }) {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-y border-hairline py-5 sm:grid-cols-4">
      <Fact k="chain" v={state ? chainName(state.chainId) : "—"} />
      <Fact k="keeper bots" v={state ? String(state.bots.length) : "4"} />
      <Fact k="gas price" v={state ? `${gwei(state.gasPriceWei)} gwei` : "—"} />
      <Fact k="use cases" v="3 · one coordinator" />
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="tnum font-mono text-[15px] text-ink">{v}</div>
      <div className="eyebrow mt-0.5">{k}</div>
    </div>
  );
}

function ComparisonBars({
  title,
  caption,
  naiveLabel,
  coordLabel,
  naive,
  coord,
  reductionPct,
}: {
  title: string;
  caption: string;
  naiveLabel: string;
  coordLabel: string;
  naive: number;
  coord: number;
  reductionPct: number;
}) {
  const coordW = naive > 0 ? Math.max(3, (coord / naive) * 100) : 0;
  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between">
        <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
        <span className="tnum font-mono text-[15px] font-semibold text-coord">−{reductionPct.toFixed(0)}%</span>
      </div>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">{caption}</p>
      <div className="mt-5 space-y-4">
        <Bar label="Naive" value={naiveLabel} widthPct={100} tone="naive" />
        <Bar label="Truce" value={coordLabel} widthPct={coordW} tone="coord" />
      </div>
    </div>
  );
}

function Bar({
  label,
  value,
  widthPct,
  tone,
}: {
  label: string;
  value: string;
  widthPct: number;
  tone: "naive" | "coord";
}) {
  const fill = tone === "naive" ? "bg-naive" : "bg-coord";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className="tnum font-mono text-[12.5px] text-ink">{value}</span>
      </div>
      <div className="h-6 overflow-hidden rounded-md bg-hairline-2">
        <div className={`h-full origin-left animate-fill rounded-md ${fill}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}

function UsefulWork({ naivePct, coordPct }: { naivePct: number; coordPct: number }) {
  return (
    <div className="card p-6">
      <h3 className="text-[15px] font-semibold tracking-tight">Useful-work ratio</h3>
      <p className="mt-1 text-[12.5px] leading-snug text-muted">
        gas that did real work ÷ gas reserved — higher is less waste
      </p>
      <div className="mt-5 space-y-4">
        <Dial label="Naive" pct={naivePct} tone="naive" />
        <Dial label="Truce" pct={coordPct} tone="coord" />
      </div>
    </div>
  );
}

function Dial({ label, pct, tone }: { label: string; pct: number; tone: "naive" | "coord" }) {
  const fill = tone === "naive" ? "bg-naive" : "bg-coord";
  const text = tone === "naive" ? "text-naive" : "text-coord";
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className={`tnum font-mono text-[15px] font-semibold ${text}`}>{pct.toFixed(0)}%</span>
      </div>
      <div className="h-6 overflow-hidden rounded-md bg-hairline-2">
        <div className={`h-full origin-left animate-fill rounded-md ${fill}`} style={{ width: `${Math.max(3, pct)}%` }} />
      </div>
    </div>
  );
}

function Counterfactual() {
  return (
    <div className="mt-8 rounded-xl border border-hairline bg-raised/60 p-5">
      <p className="text-[13.5px] leading-relaxed text-ink-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Why this is a Monad story · </span>
        On a chain that bills gas <em className="not-italic text-ink">used</em> (with revert refunds), the
        coordinated round would cost slightly <em className="not-italic text-ink">more</em> — it sends more
        transactions in total. The saving exists because Monad bills the gas you{" "}
        <em className="not-italic text-ink">declare</em>, and the losers of a race declare the full
        success-path limit. Truce moves that contention onto a claim that&apos;s cheap to declare.
      </p>
    </div>
  );
}

function PerLane({ state }: { state: ArenaState | null }) {
  const lanes = state?.lanes ?? [];
  return (
    <div className="mt-12">
      <p className="eyebrow mb-4">Per use case</p>
      <div className="card overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-hairline">
              {["Use case", "Rounds", "Naive billed", "Truce billed", "Mean saved"].map((h) => (
                <th key={h} className="px-4 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lanes.map((l) => (
              <tr key={l.id} className="border-b border-hairline-2 last:border-0">
                <td className="px-4 py-3 text-[13.5px] font-medium text-ink">{l.label}</td>
                <td className="tnum px-4 py-3 font-mono text-[12.5px] text-muted">{l.rounds}</td>
                <td className="tnum px-4 py-3 font-mono text-[12.5px] text-ink">{mon(l.cumulativeNaiveWei, 4)}</td>
                <td className="tnum px-4 py-3 font-mono text-[12.5px] text-ink">{mon(l.cumulativeCoordWei, 4)}</td>
                <td className="tnum px-4 py-3 font-mono text-[12.5px] font-semibold text-coord">
                  {l.meanSavingsPct.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EmptyState({ connected, running }: { connected: boolean; running: boolean }) {
  return (
    <div className="mt-10 grid place-items-center rounded-xl border border-dashed border-hairline py-16 text-center">
      <p className="font-mono text-[13px] text-muted">
        {connected
          ? running
            ? "Transactions are running. Results appear as each lane completes."
            : "Run the experiment to measure the difference."
          : "Start the arena to run the experiment."}
      </p>
      {!connected && (
        <code className="mt-3 rounded bg-surface px-2.5 py-1 font-mono text-[11.5px] text-ink">
          pnpm --filter @truce/arena serve --chain 10143
        </code>
      )}
    </div>
  );
}
