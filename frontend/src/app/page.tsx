"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, FlaskConical, Radio, Server, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { CLAIM_GAS_LIMIT, PERFORM_GAS_LIMIT, SLASH_REWARD_WEI } from "@/lib/chain";
import { formatMon } from "@/lib/gas";
import { Button } from "@/components/ui/button";

/** One shared clock. Every keyframe on this page is a percentage of it. */
const LOOP = "6.5s";

export default function LandingPage() {
  return (
    <div className="relative">
      <Hero />
      <Diagram />
      <Proof />
      <Doors />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

const WORD = ["T", "R", "U", "C", "E"];

function Hero() {
  return (
    <section className="grid-texture relative overflow-hidden border-b border-line px-4 pt-14 pb-10 lg:px-7 lg:pt-20">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/45 to-transparent"
      />

      <p
        className="label-micro animate-[truce-fade-up_0.7s_ease-out_both]"
        style={{ animationDelay: "80ms" }}
      >
        coordination layer · monad
      </p>

      <h1
        className="mt-4 flex select-none justify-between font-display leading-[0.82] text-fg"
        style={{
          fontSize: "clamp(58px, 15.5vw, 218px)",
          fontWeight: 900,
          letterSpacing: "-0.045em",
        }}
        aria-label="TRUCE"
      >
        {WORD.map((letter, i) => (
          <span
            key={letter}
            aria-hidden
            className={cn(
              "inline-block animate-[truce-letter_0.85s_cubic-bezier(0.2,0.85,0.25,1)_both]",
              letter === "U" && "text-accent",
            )}
            style={{ animationDelay: `${160 + i * 85}ms` }}
          >
            {letter}
          </span>
        ))}
      </h1>

      <div
        className="mt-6 h-px origin-left bg-line-strong animate-[truce-rule-in_1s_cubic-bezier(0.6,0,0.2,1)_both]"
        style={{ animationDelay: "620ms" }}
      />

      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-12 gap-y-6">
        <div
          className="max-w-[52ch] animate-[truce-fade-up_0.8s_ease-out_both]"
          style={{ animationDelay: "700ms" }}
        >
          <p className="font-display text-[19px] font-semibold tracking-[-0.01em] text-fg sm:text-[23px]">
            Coordinate first. Execute once.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            When a position goes liquidatable, every keeper watching it fires the
            same expensive transaction in the same block. One lands. The rest
            revert — and on Monad, where you are billed the{" "}
            <strong className="font-semibold text-fg">gas limit you declared</strong>,
            they pay full price for nothing.
          </p>
          <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
            TRUCE sells the right to act. Bond a cheap claim, hold exclusive
            rights for a few blocks, do the work — or lose the bond.
          </p>
        </div>

        <div
          className="flex flex-wrap gap-3 animate-[truce-fade-up_0.8s_ease-out_both]"
          style={{ animationDelay: "820ms" }}
        >
          <Button asChild variant="primary" size="lg">
            <Link href="/experiment">
              <FlaskConical />
              Run the experiment
            </Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/tasks">
              Browse tasks
              <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* The animation — four in, one out                                    */
/* ------------------------------------------------------------------ */

const KEEPERS = [
  { id: "K1", y: 62, path: "M 132 62 C 330 62, 410 200, 552 200", won: false },
  { id: "K2", y: 154, path: "M 132 154 C 330 154, 430 200, 552 200", won: true },
  { id: "K3", y: 246, path: "M 132 246 C 330 246, 430 200, 552 200", won: false },
  { id: "K4", y: 338, path: "M 132 338 C 330 338, 410 200, 552 200", won: false },
];

function Diagram() {
  return (
    <section className="border-b border-line px-4 py-8 lg:px-7">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 className="label-micro">four keepers · one eligible subject</h2>
        <span className="font-mono text-[11px] text-faint">
          claim {CLAIM_GAS_LIMIT.toLocaleString("en-US")} gas · perform{" "}
          {PERFORM_GAS_LIMIT.toLocaleString("en-US")} gas
        </span>
      </div>

      <div className="mt-3 overflow-hidden rounded-[10px] border border-line bg-panel">
        <svg
          viewBox="0 0 1200 400"
          className="w-full"
          role="img"
          aria-label="Four keepers claim the same subject; the coordinator awards rights to one, the other three stand down."
        >
          {/* Inbound wires */}
          {KEEPERS.map((k, i) => (
            <g key={k.id}>
              <path
                d={k.path}
                fill="none"
                className="stroke-line-strong"
                strokeWidth={1.25}
                strokeOpacity={0.55}
              />
              <path
                d={k.path}
                fill="none"
                pathLength={100}
                strokeDasharray="9 100"
                strokeLinecap="round"
                className={cn("stroke-accent", k.won && "stroke-ok")}
                strokeWidth={3.25}
                style={{
                  animation: `truce-inbound ${LOOP} linear infinite`,
                  animationDelay: `${i * 90}ms`,
                  opacity: 0,
                }}
              />
            </g>
          ))}

          {/* Keeper nodes */}
          {KEEPERS.map((k) => (
            <g key={`node-${k.id}`}>
              <circle
                cx={110}
                cy={k.y}
                r={19}
                className="fill-surface stroke-line-strong"
                strokeWidth={1.25}
              />
              <circle
                cx={110}
                cy={k.y}
                r={19}
                fill="none"
                strokeWidth={2}
                className={k.won ? "stroke-ok" : "stroke-bad"}
                style={{
                  animation: `truce-state ${LOOP} ease-out infinite`,
                  opacity: 0,
                }}
              />
              <text
                x={110}
                y={k.y + 5}
                textAnchor="middle"
                className="fill-fg font-mono"
                fontSize={14}
                fontWeight={600}
              >
                {k.id}
              </text>
              <text
                x={110}
                y={k.y + 40}
                textAnchor="middle"
                className={cn("font-mono", k.won ? "fill-ok" : "fill-bad")}
                fontSize={12}
                letterSpacing="0.08em"
                style={{
                  animation: `truce-state ${LOOP} ease-out infinite`,
                  opacity: 0,
                }}
              >
                {k.won ? "CLAIM WON" : "STOOD DOWN"}
              </text>
              <text
                x={110}
                y={k.y + 57}
                textAnchor="middle"
                className="fill-faint font-mono"
                fontSize={11}
                style={{
                  animation: `truce-state ${LOOP} ease-out infinite`,
                  opacity: 0,
                }}
              >
                {k.won ? "holds rights 3 blk" : "130k, not 500k"}
              </text>
            </g>
          ))}

          {/* Coordinator gate */}
          <g>
            <rect
              x={560}
              y={110}
              width={80}
              height={180}
              rx={10}
              className="fill-elevated stroke-line-strong"
              strokeWidth={1.25}
            />
            <rect
              x={560}
              y={110}
              width={80}
              height={180}
              rx={10}
              fill="none"
              strokeWidth={2}
              className="stroke-accent"
              style={{
                animation: `truce-gate ${LOOP} ease-out infinite`,
                opacity: 0,
              }}
            />
            {/* brand mark */}
            <rect x={598.5} y={187} width={3} height={26} rx={1.5} className="fill-accent" />
            <rect
              x={587}
              y={198.5}
              width={26}
              height={3}
              rx={1.5}
              className="fill-accent"
              fillOpacity={0.45}
            />
            <text
              x={600}
              y={322}
              textAnchor="middle"
              className="fill-faint font-mono"
              fontSize={11}
              letterSpacing="0.16em"
            >
              COORDINATOR
            </text>
            <text
              x={600}
              y={92}
              textAnchor="middle"
              className="fill-faint font-mono"
              fontSize={11}
            >
              first bond wins
            </text>
          </g>

          {/* Outbound */}
          <path
            d="M 648 200 L 1024 200"
            fill="none"
            className="stroke-line-strong"
            strokeWidth={1.25}
            strokeOpacity={0.55}
          />
          <path
            d="M 648 200 L 1024 200"
            fill="none"
            pathLength={100}
            strokeDasharray="9 100"
            strokeLinecap="round"
            className="stroke-ok"
            strokeWidth={3.25}
            style={{
              animation: `truce-outbound ${LOOP} linear infinite`,
              opacity: 0,
            }}
          />

          {/* Execution terminal */}
          <g
            className="svg-center"
            style={{ animation: `truce-arrive ${LOOP} ease-out infinite`, opacity: 0 }}
          >
            <rect
              x={1030}
              y={176}
              width={150}
              height={48}
              rx={8}
              className="fill-ok/12 stroke-ok"
              strokeWidth={1.5}
            />
            <text
              x={1105}
              y={206}
              textAnchor="middle"
              className="fill-ok font-mono"
              fontSize={14}
              fontWeight={600}
              letterSpacing="0.12em"
            >
              EXECUTE
            </text>
            <text
              x={1105}
              y={248}
              textAnchor="middle"
              className="fill-faint font-mono"
              fontSize={11}
            >
              one tx · 500k declared
            </text>
          </g>
        </svg>
      </div>

      <p className="mt-3 max-w-[76ch] text-[12.5px] leading-relaxed text-faint">
        Three of those four never send the expensive transaction at all. That is
        the whole product — the coordinator does not make execution faster, it
        makes losing cheap.
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Proof                                                               */
/* ------------------------------------------------------------------ */

function Proof() {
  return (
    <section className="grid gap-px border-b border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
      <Figure
        value="49.0%"
        unit="less block gas"
        note="2,000,000 → 1,020,000 declared, measured on anvil"
        tone="ok"
      />
      <Figure
        value="3.8×"
        unit="cheaper to lose"
        note={`${CLAIM_GAS_LIMIT.toLocaleString("en-US")} gas to stand down instead of ${PERFORM_GAS_LIMIT.toLocaleString("en-US")}`}
      />
      <Figure
        value="3"
        unit="block window"
        note="≈1.2s of exclusive rights, then anyone can resolve you"
      />
      <Figure
        value={formatMon(SLASH_REWARD_WEI, 3)}
        unit="MON slash reward"
        note="Fixed, so griefing the griefers never becomes a business"
      />
    </section>
  );
}

function Figure({
  value,
  unit,
  note,
  tone,
}: {
  value: string;
  unit: string;
  note: string;
  tone?: "ok";
}) {
  return (
    <div className="bg-canvas px-5 py-6 lg:px-7">
      <div
        className={cn(
          "font-display text-[34px] leading-none tracking-[-0.03em]",
          tone === "ok" ? "text-ok" : "text-fg",
        )}
        style={{ fontWeight: 900 }}
        data-numeric
      >
        {value}
      </div>
      <div className="mt-2 label-micro">{unit}</div>
      <p className="mt-2.5 text-[12px] leading-relaxed text-faint">{note}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Entry points                                                        */
/* ------------------------------------------------------------------ */

const DOORS = [
  {
    href: "/experiment",
    icon: FlaskConical,
    title: "The experiment",
    body: "Drop a position underwater and race four keepers through both rounds. Includes the counterfactual where this argument fails.",
  },
  {
    href: "/tasks",
    icon: Server,
    title: "Tasks",
    body: "Every registered task is six immutable fields hashed into an id. Read the predicate, the bond, the window and the slash record.",
  },
  {
    href: "/keeper",
    icon: Radio,
    title: "Run a keeper",
    body: "Set safety limits, generate a keeper.yml, and watch the stand-down counter — the coordination layer visibly working.",
  },
  {
    href: "/register",
    icon: Terminal,
    title: "Register a task",
    body: "Point the coordinator at any predicate that answers isEligible() under 50,000 gas. It never learns what the job is.",
  },
];

function Doors() {
  return (
    <section className="px-4 py-8 lg:px-7">
      <h2 className="label-micro">where to go</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {DOORS.map((d) => {
          const Icon = d.icon;
          return (
            <Link
              key={d.href}
              href={d.href}
              className="group flex flex-col rounded-[10px] border border-line bg-panel px-4 py-4 transition-colors hover:border-line-strong"
            >
              <span className="flex items-center justify-between">
                <Icon className="size-4 text-faint transition-colors group-hover:text-accent" />
                <ArrowRight className="size-3.5 text-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
              </span>
              <span className="mt-3 text-[14px] font-semibold tracking-[-0.01em] text-fg">
                {d.title}
              </span>
              <span className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
                {d.body}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
