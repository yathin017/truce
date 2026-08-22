"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  Play,
  RotateCcw,
  TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGasExact, formatMon, reductionPct, usedCostWei } from "@/lib/gas";
import { BASE_FEE_WEI, CLAIM_GAS_LIMIT, PERFORM_GAS_LIMIT } from "@/lib/chain";
import {
  MEASURED,
  USEFUL_GAS,
  coordinatedRound,
  healthFactorAt,
  isLiquidatable,
  naiveRound,
} from "@/lib/experiment";
import { DEMO_POSITION, DROPPED_PRICE } from "@/services/truce";
import type { BotState, ExperimentRound } from "@/types/truce";
import { Button } from "@/components/ui/button";
import { GasBars } from "@/components/instrument/GasBars";
import { MonValue } from "@/components/instrument/MonValue";

type Phase = "idle" | "naive" | "coordinated" | "done";

const OUTCOME_STYLE: Record<
  BotState["outcome"],
  { chip: string; label: string }
> = {
  idle: { chip: "border-line bg-surface text-faint", label: "idle" },
  sending: { chip: "border-warn/45 bg-warn/10 text-warn", label: "sending" },
  success: { chip: "border-ok/45 bg-ok/12 text-ok", label: "landed" },
  reverted: { chip: "border-bad/50 bg-bad/12 text-bad", label: "reverted" },
  claiming: { chip: "border-warn/45 bg-warn/10 text-warn", label: "claiming" },
  "claim-won": { chip: "border-ok/45 bg-ok/12 text-ok", label: "claim won" },
  "stood-down": { chip: "border-bad/50 bg-bad/12 text-bad", label: "stood down" },
  executing: { chip: "border-accent/50 bg-accent-soft text-accent", label: "executing" },
};

export default function ExperimentPage() {
  const [price, setPrice] = React.useState(DEMO_POSITION.collateralPrice);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [naive, setNaive] = React.useState<ExperimentRound | null>(null);
  const [coord, setCoord] = React.useState<ExperimentRound | null>(null);
  const [running, setRunning] = React.useState(false);
  const [revealed, setRevealed] = React.useState(false);

  const hf = healthFactorAt({ ...DEMO_POSITION, collateralPrice: price }, price);
  const liquidatable = isLiquidatable(hf);
  const collateralUsd = DEMO_POSITION.collateral * price;

  const reset = () => {
    setPrice(DEMO_POSITION.collateralPrice);
    setPhase("idle");
    setNaive(null);
    setCoord(null);
    setRevealed(false);
  };

  const runNaive = async () => {
    setRunning(true);
    setPhase("naive");
    const round = naiveRound();
    setNaive({ ...round, bots: round.bots.map((b) => ({ ...b, outcome: "sending" })) });
    await wait(900);
    setNaive(round);
    setRunning(false);
  };

  const runCoordinated = async () => {
    setRunning(true);
    setPhase("coordinated");
    const round = coordinatedRound();
    setCoord({
      ...round,
      bots: round.bots
        .slice(0, 4)
        .map((b) => ({ ...b, outcome: "claiming" as const })),
    });
    await wait(700);
    setCoord({ ...round, bots: round.bots.slice(0, 4) });
    await wait(700);
    setCoord(round);
    setPhase("done");
    setRunning(false);
  };

  return (
    <div className="px-4 py-7 lg:px-7">
      <header className="max-w-[74ch]">
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">
          The experiment
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">
          Four keepers. One liquidatable position. Run it the way keepers run it
          today, then run it through the coordinator. Monad bills the{" "}
          <strong className="font-semibold text-fg">declared gas limit</strong>, not
          gas used — so every loser in a race pays full price for nothing.
        </p>
      </header>

      {/* Stage 1 — the position */}
      <section className="grid-texture mt-6 rounded-[10px] border border-line bg-panel">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-line px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold text-fg">
            EnforcedMockPool · demo position
          </h2>
          <span className="font-mono text-[11px] text-faint">
            healthFactor = collateral × price × 0.85 / debt
          </span>
        </div>

        <div className="grid gap-y-6 px-5 py-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:gap-x-10">
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            <Stat label="collateral" value={`${DEMO_POSITION.collateral} tokens`} />
            <Stat
              label="collateral value"
              value={`$${collateralUsd.toLocaleString("en-US")}`}
              tone={price < DEMO_POSITION.collateralPrice ? "bad" : undefined}
            />
            <Stat label="debt" value={`$${DEMO_POSITION.debt.toLocaleString("en-US")}`} />
            <Stat
              label="health factor"
              value={hf.toFixed(3)}
              tone={liquidatable ? "bad" : "ok"}
              big
            />
          </div>

          <div className="flex flex-col justify-between gap-4 lg:min-w-[260px]">
            <div>
              <div className="flex items-baseline justify-between">
                <span className="label-micro">collateral price</span>
                <span
                  className={cn(
                    "font-mono text-[15px]",
                    price < DEMO_POSITION.collateralPrice ? "text-bad" : "text-fg",
                  )}
                  data-numeric
                >
                  ${price.toLocaleString("en-US")}
                </span>
              </div>
              <div className="tick-rule-fine mt-2.5 h-2 overflow-hidden rounded-full bg-surface">
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-700 ease-out",
                    liquidatable ? "bg-bad" : "bg-ok",
                  )}
                  style={{ width: `${(price / DEMO_POSITION.collateralPrice) * 100}%` }}
                />
              </div>
              <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
                {liquidatable
                  ? "isEligible() now returns true. Every keeper watching this subject sees it in the same block."
                  : `Liquidatable below $${Math.ceil(
                      DEMO_POSITION.debt /
                        (DEMO_POSITION.collateral * DEMO_POSITION.liquidationThreshold),
                    )}.`}
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={liquidatable ? "outline" : "danger"}
                onClick={() => setPrice(DROPPED_PRICE)}
                disabled={liquidatable}
              >
                <TrendingDown />
                Drop price to ${DROPPED_PRICE}
              </Button>
              <Button variant="ghost" size="icon" onClick={reset} aria-label="Reset">
                <RotateCcw />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stage 2 — the two rounds */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <RoundPanel
          title="Round A · naive"
          subtitle="Everyone fires the liquidation directly"
          round={naive}
          tone="bad"
          disabled={!liquidatable}
          running={running && phase === "naive"}
          onRun={runNaive}
          footnote={`Each tx declares ${formatGasExact(PERFORM_GAS_LIMIT)} gas. Three of them revert with "already liquidated" — and are billed in full anyway.`}
        />
        <RoundPanel
          title="Round B · coordinated"
          subtitle="Everyone fires the cheap claim first"
          round={coord}
          tone="ok"
          disabled={!naive}
          running={running && phase === "coordinated"}
          onRun={runCoordinated}
          footnote={`Each claim declares ${formatGasExact(CLAIM_GAS_LIMIT)} gas. Three revert with SubjectAlreadyClaimed(); the winner then performs at ${formatGasExact(PERFORM_GAS_LIMIT)}.`}
        />
      </div>

      {/* Stage 3 — the result */}
      {naive && coord ? (
        <Results naive={naive} coord={coord} />
      ) : null}

      {/* Stage 4 — the reveal */}
      {phase === "done" ? (
        <section className="mt-5 overflow-hidden rounded-[10px] border border-accent/35 bg-accent-soft">
          <div className="px-5 py-5">
            <button
              onClick={() => setRevealed((v) => !v)}
              className="flex w-full items-center justify-between gap-4 text-left"
            >
              <span>
                <span className="label-micro text-accent">and now the point</span>
                <span className="mt-1.5 block text-[17px] font-semibold tracking-[-0.01em] text-fg">
                  The coordinator has no idea what a liquidation is.
                </span>
              </span>
              <ArrowRight
                className={cn(
                  "size-5 shrink-0 text-accent transition-transform",
                  revealed && "rotate-90",
                )}
              />
            </button>

            {revealed ? (
              <div className="mt-4 border-t border-accent/25 pt-4">
                <p className="max-w-[76ch] text-[13px] leading-relaxed text-muted">
                  Nothing in <code className="font-mono text-fg">Coordinator.sol</code>{" "}
                  mentions collateral, health factors or debt. It asks one contract
                  one question —{" "}
                  <code className="font-mono text-fg">isEligible(subject, checkParam)</code>{" "}
                  — under a {MEASURED.claimGasLimit ? "50,000" : ""} gas cap, and sells
                  exclusive rights to whoever bonds first. Swap the predicate and the
                  same machinery coordinates something else entirely:
                </p>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <SwapCard
                    title="AaveHealthPredicate"
                    param="checkParam = pool address"
                    body="true when healthFactor < 1"
                  />
                  <SwapCard
                    title="PriceDivergencePredicate"
                    param="checkParam = oracle | thresholdBps"
                    body="true when pool and oracle diverge past the threshold"
                  />
                  <SwapCard
                    title="IntervalPredicate"
                    param="checkParam = seconds"
                    body="true when the interval has elapsed since last run"
                  />
                </div>
                <Button asChild variant="primary" size="sm" className="mt-4">
                  <Link href="/tasks">See all three registered →</Link>
                </Button>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Results({
  naive,
  coord,
}: {
  naive: ExperimentRound;
  coord: ExperimentRound;
}) {
  const declaredCut = reductionPct(
    naive.metrics.declaredExposureGas,
    coord.metrics.declaredExposureGas,
  );
  const usedCut = reductionPct(naive.metrics.usedGas, coord.metrics.usedGas);

  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="rounded-[10px] border border-line bg-panel">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-5 py-3.5">
          <h2 className="text-[13.5px] font-semibold text-fg">
            Block gas reserved — the Monad basis
          </h2>
          <span className="font-mono text-[11px] text-faint">
            solid = gas that did real work
          </span>
        </div>
        <div className="px-5 py-5">
          <GasBars
            rows={[
              {
                label: "Round A · naive",
                gas: naive.metrics.declaredExposureGas,
                usefulGas: USEFUL_GAS,
                tone: "bad",
                note: `${naive.metrics.txCount} txs, all declaring the success-path limit`,
              },
              {
                label: "Round B · coordinated",
                gas: coord.metrics.declaredExposureGas,
                usefulGas: USEFUL_GAS,
                tone: "ok",
                note: `${coord.metrics.txCount} txs — 4 cheap claims, 1 perform`,
              },
              {
                label: "Theoretical floor",
                gas: USEFUL_GAS,
                usefulGas: USEFUL_GAS,
                tone: "accent",
                note: "one keeper, perfect information, no race",
              },
            ]}
          />

          <div className="mt-6 flex flex-wrap items-end gap-x-10 gap-y-4 border-t border-line pt-4">
            <Headline
              label="declared gas cut"
              value={`${declaredCut.toFixed(1)}%`}
              tone="ok"
            />
            <Headline
              label="useful-work ratio"
              value={`${(naive.metrics.usefulWorkRatio * 100).toFixed(1)}% → ${(
                coord.metrics.usefulWorkRatio * 100
              ).toFixed(1)}%`}
            />
            <Headline
              label="MON saved per event"
              value={`${formatMon(
                usedCostWei(
                  naive.metrics.declaredExposureGas - coord.metrics.declaredExposureGas,
                  BASE_FEE_WEI,
                ),
                4,
              )} MON`}
              tone="ok"
            />
          </div>
        </div>
      </div>

      {/* Honesty panel */}
      <div className="space-y-5">
        <div className="rounded-[10px] border border-warn/40 bg-warn-soft px-5 py-4">
          <div className="label-micro text-warn">the counterfactual</div>
          <h3 className="mt-1.5 text-[14px] font-semibold text-fg">
            On a gas-used chain, this is a loss.
          </h3>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            Reverts are cheap when you only pay for what you burn. Coordination adds
            real transactions, so on Ethereum-style billing the same two rounds go
            the other way:
          </p>
          <dl className="mt-3.5 space-y-2 border-t border-warn/25 pt-3">
            <Line
              label="naive gas used"
              value={formatGasExact(naive.metrics.usedGas)}
            />
            <Line
              label="coordinated gas used"
              value={formatGasExact(coord.metrics.usedGas)}
            />
            <Line
              label="change"
              value={`${usedCut > 0 ? "−" : "+"}${Math.abs(usedCut).toFixed(0)}%`}
              tone={usedCut > 0 ? "ok" : "bad"}
            />
          </dl>
          <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
            TRUCE is a Monad-shaped answer to a Monad-shaped problem. Where the
            declared limit is the bill, cheap coordination beats expensive racing.
          </p>
        </div>

        <div className="rounded-[10px] border border-line bg-panel px-5 py-4">
          <div className="label-micro">measured on anvil</div>
          <dl className="mt-3 space-y-2">
            <Line
              label="liquidate (success)"
              value={`${formatGasExact(MEASURED.liquidationGasUsed)} gas`}
            />
            <Line
              label="claim via executor"
              value={`${formatGasExact(MEASURED.claimGasUsedViaExecutor)} gas`}
            />
            <Line
              label="naive revert"
              value={`${formatGasExact(MEASURED.naiveRevertGasUsed)} gas`}
            />
            <Line
              label="SubjectAlreadyClaimed"
              value={`${formatGasExact(MEASURED.claimRevertGasUsed)} gas`}
            />
          </dl>
          <div className="mt-3 border-t border-line pt-3">
            <div className="flex items-baseline justify-between">
              <span className="label-micro">cost of standing down</span>
              <MonValue
                wei={usedCostWei(MEASURED.claimGasLimit, BASE_FEE_WEI)}
                size="sm"
                tone="bad"
              />
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-faint">
              That is what a losing keeper pays per event under coordination,
              instead of {formatMon(usedCostWei(PERFORM_GAS_LIMIT, BASE_FEE_WEI), 4)}{" "}
              MON for a revert.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function RoundPanel({
  title,
  subtitle,
  round,
  tone,
  disabled,
  running,
  onRun,
  footnote,
}: {
  title: string;
  subtitle: string;
  round: ExperimentRound | null;
  tone: "ok" | "bad";
  disabled: boolean;
  running: boolean;
  onRun: () => void;
  footnote: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col rounded-[10px] border bg-panel",
        round ? (tone === "bad" ? "border-bad/35" : "border-ok/35") : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-3.5">
        <div>
          <h2 className="text-[13.5px] font-semibold text-fg">{title}</h2>
          <p className="mt-0.5 text-[12px] text-faint">{subtitle}</p>
        </div>
        <Button
          size="sm"
          variant={round ? "outline" : "primary"}
          disabled={disabled || running}
          onClick={onRun}
        >
          <Play />
          {running ? "running…" : round ? "re-run" : "run"}
        </Button>
      </div>

      <div className="flex-1 px-5 py-4">
        {!round ? (
          <p className="py-8 text-center text-[12.5px] text-faint">
            {disabled
              ? "Drop the price first — nothing is eligible yet."
              : "Ready."}
          </p>
        ) : (
          <ul className="space-y-2">
            {round.bots.map((bot) => (
              <BotRow key={bot.id} bot={bot} />
            ))}
          </ul>
        )}
      </div>

      {round ? (
        <div className="border-t border-line px-5 py-3.5">
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2">
            <Stat
              label="block gas reserved"
              value={formatGasExact(round.metrics.blockGasReserved)}
              tone={tone}
            />
            <Stat
              label="MON billed"
              value={`${formatMon(
                usedCostWei(round.metrics.declaredExposureGas, BASE_FEE_WEI),
                4,
              )} MON`}
              tone={tone}
            />
            <Stat
              label="useful"
              value={`${(round.metrics.usefulWorkRatio * 100).toFixed(1)}%`}
            />
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">{footnote}</p>
        </div>
      ) : null}
    </section>
  );
}

function BotRow({ bot }: { bot: BotState }) {
  const style = OUTCOME_STYLE[bot.outcome];
  const pending = bot.outcome === "sending" || bot.outcome === "claiming";

  return (
    <li className="flex items-center gap-3 rounded-[6px] border border-line bg-surface px-3 py-2.5">
      <span className="w-16 shrink-0 font-mono text-[12px] font-semibold text-fg">
        {bot.label}
      </span>
      <span
        className={cn(
          "shrink-0 rounded-[4px] border px-2 py-[3px] font-mono text-[10px] uppercase tracking-[0.1em]",
          style.chip,
          pending && "animate-[truce-alarm_1.1s_ease-in-out_infinite]",
        )}
      >
        {style.label}
      </span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-faint">{bot.note}</span>
      <span className="shrink-0 text-right">
        <span className="block font-mono text-[12px] text-fg" data-numeric>
          {formatGasExact(bot.declaredGas)}
        </span>
        <span className="block font-mono text-[10.5px] text-faint" data-numeric>
          used {formatGasExact(bot.usedGas)}
        </span>
      </span>
    </li>
  );
}

function Stat({
  label,
  value,
  tone,
  big,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
  big?: boolean;
}) {
  return (
    <div>
      <div className="label-micro">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono tracking-[-0.01em]",
          big ? "text-[24px]" : "text-[15px]",
          tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-fg",
        )}
        data-numeric
      >
        {value}
      </div>
    </div>
  );
}

function Headline({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok";
}) {
  return (
    <div>
      <div className="label-micro">{label}</div>
      <div
        className={cn(
          "mt-1 font-mono text-[26px] tracking-[-0.02em]",
          tone === "ok" ? "text-ok" : "text-fg",
        )}
        data-numeric
      >
        {value}
      </div>
    </div>
  );
}

function Line({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "ok" | "bad";
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label-micro">{label}</span>
      <span
        className={cn(
          "font-mono text-[12.5px]",
          tone === "ok" ? "text-ok" : tone === "bad" ? "text-bad" : "text-fg",
        )}
        data-numeric
      >
        {value}
      </span>
    </div>
  );
}

function SwapCard({
  title,
  param,
  body,
}: {
  title: string;
  param: string;
  body: string;
}) {
  return (
    <div className="rounded-[7px] border border-line bg-panel px-3.5 py-3">
      <div className="font-mono text-[11.5px] font-semibold text-fg">{title}</div>
      <div className="mt-1 font-mono text-[10.5px] text-accent">{param}</div>
      <p className="mt-2 text-[11.5px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => window.setTimeout(r, ms));
}
