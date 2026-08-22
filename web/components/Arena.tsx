"use client";

import { useState } from "react";
import type { ArenaHandle } from "@/lib/arena";
import { LANE_META, LANE_ORDER, type LaneId } from "@/lib/types";
import { mon } from "@/lib/format";
import { GasCompare } from "./GasCompare";
import { LaneColumns } from "./LaneColumns";

export function Arena({ arena }: { arena: ArenaHandle }) {
  const [lane, setLane] = useState<LaneId>("liquidation");
  const { state, lastRound, runningLane, fireLane, setAuto } = arena;

  const meta = LANE_META[lane];
  const round = lastRound[lane];
  const laneStat = state?.lanes.find((l) => l.id === lane);
  const running = runningLane === lane;
  const auto = state?.auto.running ?? false;
  const capBig = state ? BigInt(state.budget.capWei) > 1000n * 10n ** 18n : false;
  const remaining = !state ? "—" : capBig ? "dev · uncapped" : `${mon(state.budget.remainingWei, 2)} MON`;

  return (
    <section id="arena" className="border-t border-hairline">
      <div className="wrap py-20 sm:py-24">
        <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-xl">
            <p className="eyebrow">The arena · live on-chain</p>
            <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.4rem]">
              Two ways to run the same job, side by side.
            </h2>
            <p className="mt-4 text-[15.5px] leading-relaxed text-ink-2">
              Real bots, real transactions, one coordinator. Each row is a real tx you can open on
              the explorer. Watch the losers on the left get billed in full for doing nothing.
            </p>
          </div>
          <Controls
            connected={arena.connected}
            running={running}
            auto={auto}
            remaining={remaining}
            onRun={() => fireLane(lane)}
            onAuto={() => setAuto(!auto)}
          />
        </div>

        <div className="mt-10">
          <Tabs lane={lane} onSelect={setLane} stats={state} />
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
          <div className="space-y-4">
            <div className="card p-5">
              <h3 className="text-[15px] font-semibold tracking-tight">{meta.short}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-muted">{meta.blurb}</p>
              <dl className="mt-4 space-y-2 border-t border-hairline pt-4 font-mono text-[11.5px]">
                <Row k="opportunity" v={meta.opportunity} />
                <Row k="losers revert on" v={meta.reverts} />
                <Row k="rounds run" v={laneStat ? String(laneStat.rounds) : "0"} />
                <Row
                  k="mean saved"
                  v={laneStat ? `${laneStat.meanSavingsPct.toFixed(1)}%` : "—"}
                  accent
                />
              </dl>
            </div>
            <GasCompare
              naiveWei={round?.naive.declaredWei ?? "0"}
              coordWei={round?.coordinated.declaredWei ?? "0"}
              savingsPct={round?.savingsPct ?? 0}
            />
          </div>

          <LaneColumns round={round} running={running} />
        </div>
      </div>
    </section>
  );
}

function Row({ k, v, accent }: { k: string; v: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-muted">{k}</dt>
      <dd className={`text-right ${accent ? "font-semibold text-coord" : "text-ink"}`}>{v}</dd>
    </div>
  );
}

function Tabs({
  lane,
  onSelect,
  stats,
}: {
  lane: LaneId;
  onSelect: (l: LaneId) => void;
  stats: ArenaHandle["state"];
}) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {LANE_ORDER.map((id) => {
        const active = id === lane;
        const s = stats?.lanes.find((l) => l.id === id);
        return (
          <button
            key={id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(id)}
            className={`group flex items-center gap-3 rounded-lg border px-4 py-2.5 text-left transition-colors ${
              active ? "border-ink bg-surface" : "border-hairline bg-transparent hover:bg-surface"
            }`}
          >
            <div>
              <div className={`text-[13.5px] font-semibold ${active ? "text-ink" : "text-ink-2"}`}>
                {LANE_META[id].short}
              </div>
              <div className="eyebrow mt-0.5">
                {s && s.rounds > 0 ? `${s.meanSavingsPct.toFixed(0)}% saved` : "ready"}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function Controls({
  connected,
  running,
  auto,
  remaining,
  onRun,
  onAuto,
}: {
  connected: boolean;
  running: boolean;
  auto: boolean;
  remaining: string;
  onRun: () => void;
  onAuto: () => void;
}) {
  return (
    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
      <div className="flex items-center gap-2">
        <button onClick={onRun} disabled={!connected || running || auto} className="btn btn-solid">
          {running ? "racing…" : "Run one round"}
        </button>
        <button onClick={onAuto} disabled={!connected} className="btn">
          {auto ? "■ Stop auto" : "▶ Auto-loop"}
        </button>
      </div>
      <span className="font-mono text-[11px] text-faint">
        {connected ? `budget left · ${remaining}` : "arena offline"}
      </span>
    </div>
  );
}
