"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, Gauge, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatGasExact, formatMon } from "@/lib/gas";
import {
  CLAIM_GAS_LIMIT,
  DEFAULT_BOND_WEI,
  DEFAULT_WINDOW_BLOCKS,
  MONAD_TESTNET,
  PERFORM_GAS_LIMIT,
  PREDICATE_GAS_CAP,
} from "@/lib/chain";
import {
  ZERO_ADDRESS,
  isAddress,
  packIntervalParam,
  packPriceParam,
  subjectFromAddress,
} from "@/lib/encoding";
import {
  DEPLOYMENT,
  computeTaskId,
  probePredicate,
  registerTask,
} from "@/services/truce";
import { useWallet } from "@/providers/WalletProvider";
import type { CheckParamShape, Hex, PredicateProbe, TaskParams } from "@/types/truce";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonValue } from "@/components/instrument/MonValue";
import { Hash } from "@/components/instrument/Mono";
import { WindowLabel } from "@/components/instrument/BlockCountdown";

const SHAPES: { id: CheckParamShape; label: string; blurb: string }[] = [
  {
    id: "address",
    label: "address",
    blurb: "The whole 32-byte word is one address — e.g. the pool to query.",
  },
  {
    id: "price",
    label: "price divergence",
    blurb: "oracle in the low 160 bits, thresholdBps in the next 16.",
  },
  {
    id: "interval",
    label: "interval",
    blurb: "The raw interval in seconds. Nothing packed.",
  },
];

function parseMon(input: string): bigint {
  const trimmed = input.trim();
  if (!/^\d*\.?\d*$/.test(trimmed) || trimmed === "" || trimmed === ".") return 0n;
  const [whole, frac = ""] = trimmed.split(".");
  return BigInt(whole || "0") * 10n ** 18n + BigInt(frac.padEnd(18, "0").slice(0, 18));
}

export default function RegisterPage() {
  const { address } = useWallet();

  const [predicate, setPredicate] = React.useState(DEPLOYMENT.tasks.aave.predicate as string);
  const [shape, setShape] = React.useState<CheckParamShape>("address");
  const [paramAddress, setParamAddress] = React.useState(
    (DEPLOYMENT.mockPool ?? ZERO_ADDRESS) as string,
  );
  const [thresholdBps, setThresholdBps] = React.useState("100");
  const [intervalSeconds, setIntervalSeconds] = React.useState("3600");
  const [windowBlocks, setWindowBlocks] = React.useState(String(DEFAULT_WINDOW_BLOCKS));
  const [bond, setBond] = React.useState(formatMon(DEFAULT_BOND_WEI));
  const [bounty, setBounty] = React.useState("0");
  const [escrow, setEscrow] = React.useState("0");
  const [probeSubject, setProbeSubject] = React.useState(
    "0x00000000000000000000000000000000000A11cE",
  );

  const [probe, setProbe] = React.useState<PredicateProbe | null>(null);
  const [probing, setProbing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [result, setResult] = React.useState<{ taskId: Hex; txHash: Hex } | null>(null);

  const checkParam: Hex = React.useMemo(() => {
    try {
      if (shape === "address") {
        return isAddress(paramAddress)
          ? subjectFromAddress(paramAddress)
          : (`0x${"0".repeat(64)}` as Hex);
      }
      if (shape === "price") {
        return isAddress(paramAddress)
          ? packPriceParam(Number(thresholdBps) || 0, paramAddress)
          : (`0x${"0".repeat(64)}` as Hex);
      }
      return packIntervalParam(Number(intervalSeconds) || 0);
    } catch {
      return `0x${"0".repeat(64)}` as Hex;
    }
  }, [shape, paramAddress, thresholdBps, intervalSeconds]);

  const bondWei = parseMon(bond);
  const bountyWei = parseMon(bounty);
  const escrowWei = parseMon(escrow);
  const windows = Number(windowBlocks) || 0;

  const params: TaskParams = React.useMemo(
    () => ({
      predicate: (isAddress(predicate) ? predicate : ZERO_ADDRESS) as TaskParams["predicate"],
      checkParam,
      windowBlocks: windows,
      bondWei,
      bountyPerJob: bountyWei,
      sponsor: (address ?? ZERO_ADDRESS) as TaskParams["sponsor"],
      active: true,
    }),
    [predicate, checkParam, windows, bondWei, bountyWei, address],
  );

  const predicted = computeTaskId(params);

  const errors: string[] = [];
  if (!isAddress(predicate)) errors.push("Predicate must be a 20-byte address.");
  if (windows < 1) errors.push("windowBlocks must be at least 1.");
  if (bondWei <= 0n) errors.push("A zero bond makes claims free — nothing is at stake.");
  if (bountyWei > 0n && escrowWei < bountyWei)
    errors.push("Escrow is below one bounty — the first consume would revert.");

  const runProbe = async () => {
    setProbing(true);
    const out = await probePredicate({
      predicate,
      subject: subjectFromAddress(
        isAddress(probeSubject) ? probeSubject : ZERO_ADDRESS,
      ),
      checkParam,
    });
    setProbe(out);
    setProbing(false);
  };

  const submit = async () => {
    setSubmitting(true);
    const receipt = await registerTask(params);
    setResult({ taskId: receipt.taskId, txHash: receipt.txHash });
    setSubmitting(false);
  };

  return (
    <div className="px-4 py-7 lg:px-7">
      <header>
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-fg">
          Register a task
        </h1>
        <p className="mt-1.5 max-w-[68ch] text-[13.5px] leading-relaxed text-muted">
          A task is six immutable fields hashed into an id. Registering is
          permissionless — the coordinator never validates that your predicate is
          honest, only that it answers under{" "}
          {PREDICATE_GAS_CAP.toLocaleString("en-US")} gas.
        </p>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="min-w-0 space-y-5">
          {/* Predicate */}
          <Panel title="1 · Predicate" note="staticcall isEligible(subject, checkParam)">
            <Field label="predicate address">
              <Input
                value={predicate}
                onChange={(e) => setPredicate(e.target.value)}
                spellCheck={false}
                className="font-mono text-[12.5px]"
                placeholder="0x…"
              />
            </Field>

            <div className="mt-4">
              <div className="label-micro">checkParam shape</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {SHAPES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setShape(s.id)}
                    className={cn(
                      "rounded-[6px] border px-3 py-1.5 font-mono text-[11.5px] transition-colors",
                      shape === s.id
                        ? "border-accent/50 bg-accent-soft text-accent"
                        : "border-line bg-surface text-faint hover:text-muted",
                    )}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[11.5px] text-faint">
                {SHAPES.find((s) => s.id === shape)?.blurb}
              </p>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {shape !== "interval" ? (
                <Field label={shape === "price" ? "reference oracle" : "target address"}>
                  <Input
                    value={paramAddress}
                    onChange={(e) => setParamAddress(e.target.value)}
                    spellCheck={false}
                    className="font-mono text-[12.5px]"
                  />
                </Field>
              ) : null}
              {shape === "price" ? (
                <Field label="threshold (bps)" hint={`${Number(thresholdBps) / 100}%`}>
                  <Input
                    type="number"
                    value={thresholdBps}
                    onChange={(e) => setThresholdBps(e.target.value)}
                    className="font-mono text-[12.5px]"
                  />
                </Field>
              ) : null}
              {shape === "interval" ? (
                <Field
                  label="interval (seconds)"
                  hint={`${(Number(intervalSeconds) / 3600).toFixed(2)}h`}
                >
                  <Input
                    type="number"
                    value={intervalSeconds}
                    onChange={(e) => setIntervalSeconds(e.target.value)}
                    className="font-mono text-[12.5px]"
                  />
                </Field>
              ) : null}
            </div>

            <div className="mt-4 rounded-[6px] border border-line bg-surface px-3 py-2.5">
              <div className="label-micro">encoded checkParam</div>
              <div className="mt-1.5 break-all font-mono text-[11.5px] text-fg">
                {checkParam}
              </div>
            </div>
          </Panel>

          {/* Economics */}
          <Panel title="2 · Economics" note="all fields fold into the taskId">
            <div className="grid gap-4 sm:grid-cols-3">
              <Field
                label="windowBlocks"
                hint={windows > 0 ? `≈ ${windows * MONAD_TESTNET.blockMs}ms to execute` : undefined}
              >
                <Input
                  type="number"
                  value={windowBlocks}
                  onChange={(e) => setWindowBlocks(e.target.value)}
                  className="font-mono text-[12.5px]"
                />
              </Field>
              <Field label="bond (MON)" hint="slashed if a claim is not consumed">
                <Input
                  value={bond}
                  onChange={(e) => setBond(e.target.value)}
                  className="font-mono text-[12.5px]"
                />
              </Field>
              <Field
                label="bounty / job (MON)"
                hint={bountyWei > 0n ? "paid from escrow" : "0 = self-funding MEV"}
              >
                <Input
                  value={bounty}
                  onChange={(e) => setBounty(e.target.value)}
                  className="font-mono text-[12.5px]"
                />
              </Field>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field
                label="initial escrow (MON)"
                hint={
                  bountyWei > 0n && escrowWei > 0n
                    ? `${escrowWei / bountyWei} jobs funded`
                    : "msg.value on registerTask"
                }
              >
                <Input
                  value={escrow}
                  onChange={(e) => setEscrow(e.target.value)}
                  className="font-mono text-[12.5px]"
                />
              </Field>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-line pt-4">
              <span className="flex items-baseline gap-2.5">
                <span className="label-micro">window</span>
                <WindowLabel blocks={windows} />
              </span>
              <span className="flex items-baseline gap-2.5">
                <span className="label-micro">bond</span>
                <MonValue wei={bondWei} size="sm" />
              </span>
              <span className="flex items-baseline gap-2.5">
                <span className="label-micro">escrow</span>
                <MonValue wei={escrowWei} size="sm" />
              </span>
            </div>
          </Panel>

          {/* Probe */}
          <Panel
            title="3 · Probe the predicate"
            note={`gas cap ${PREDICATE_GAS_CAP.toLocaleString("en-US")}`}
          >
            <div className="flex flex-wrap items-end gap-3">
              <Field label="subject to test" className="min-w-[280px] flex-1">
                <Input
                  value={probeSubject}
                  onChange={(e) => setProbeSubject(e.target.value)}
                  spellCheck={false}
                  className="font-mono text-[12.5px]"
                />
              </Field>
              <Button variant="secondary" onClick={runProbe} disabled={probing}>
                {probing ? <Loader2 className="animate-spin" /> : <Gauge />}
                {probing ? "probing…" : "staticcall"}
              </Button>
            </div>

            {probe ? <ProbeReadout probe={probe} /> : null}

            <p className="mt-3 text-[11.5px] leading-relaxed text-faint">
              The coordinator wraps this call in a{" "}
              {PREDICATE_GAS_CAP.toLocaleString("en-US")} gas budget and fails closed:
              a revert, an out-of-gas, or a non-bool return all read as{" "}
              <em>not eligible</em>. A predicate that is too expensive is a task
              nobody can ever claim.
            </p>
          </Panel>
        </div>

        {/* Preview rail */}
        <aside className="space-y-5">
          <div className="sticky top-[132px] space-y-5">
            <Panel title="taskId preview" note="before you sign">
              <div className="break-all rounded-[6px] border border-line bg-surface px-3 py-2.5 font-mono text-[11.5px] text-fg">
                {predicted}
              </div>
              <p className="mt-2.5 text-[11.5px] leading-relaxed text-faint">
                Deterministic in the six fields above. If this id already exists the
                coordinator reverts with <code>TaskExists()</code> — registering the
                same tuple twice is impossible by construction.
              </p>

              <dl className="mt-4 space-y-2 border-t border-line pt-3">
                <Row label="sponsor" value={address ?? "not connected"} mono />
                <Row label="msg.value" value={`${formatMon(escrowWei)} MON`} mono />
                <Row
                  label="claim cost"
                  value={`${formatGasExact(CLAIM_GAS_LIMIT)} gas declared`}
                  mono
                />
                <Row
                  label="perform cost"
                  value={`${formatGasExact(PERFORM_GAS_LIMIT)} gas declared`}
                  mono
                />
              </dl>

              {errors.length > 0 ? (
                <ul className="mt-4 space-y-1.5 rounded-[6px] border border-warn/40 bg-warn-soft px-3 py-2.5">
                  {errors.map((e) => (
                    <li key={e} className="flex items-start gap-2 text-[11.5px] text-warn">
                      <AlertTriangle className="mt-[2px] size-3.5 shrink-0" />
                      {e}
                    </li>
                  ))}
                </ul>
              ) : null}

              <Button
                variant="primary"
                className="mt-4 w-full"
                disabled={errors.length > 0 || submitting}
                onClick={submit}
              >
                {submitting ? <Loader2 className="animate-spin" /> : null}
                {submitting ? "registering…" : "registerTask"}
              </Button>
            </Panel>

            {result ? (
              <Panel title="Registered" note="now point a keeper at it">
                <div className="space-y-2">
                  <Row label="taskId" value={result.taskId} mono truncate />
                  <Row label="tx" value={result.txHash} mono truncate />
                </div>
                <YamlSnippet taskId={result.taskId} subject={probeSubject} />
                <Button asChild variant="secondary" size="sm" className="mt-3 w-full">
                  <Link href={`/tasks/${result.taskId}`}>Open task</Link>
                </Button>
              </Panel>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}

function ProbeReadout({ probe }: { probe: PredicateProbe }) {
  const pct = Math.min(1, probe.gasUsed / probe.gasCap);
  const over = probe.gasUsed > probe.gasCap;

  return (
    <div
      className={cn(
        "mt-4 rounded-[7px] border px-3.5 py-3",
        probe.reverted || over
          ? "border-bad/45 bg-bad-soft"
          : probe.eligible
            ? "border-ok/45 bg-ok-soft"
            : "border-line bg-surface",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className={cn(
            "font-mono text-[12px] font-semibold uppercase tracking-[0.14em]",
            probe.reverted || over ? "text-bad" : probe.eligible ? "text-ok" : "text-muted",
          )}
        >
          {probe.reverted
            ? "reverted"
            : over
              ? "over gas cap"
              : probe.eligible
                ? "eligible = true"
                : "eligible = false"}
        </span>
        {!probe.reverted ? (
          <span className="font-mono text-[12px] text-fg" data-numeric>
            {formatGasExact(probe.gasUsed)} / {formatGasExact(probe.gasCap)} gas
          </span>
        ) : null}
      </div>

      {!probe.reverted ? (
        <div className="tick-rule-fine relative mt-2.5 h-2 overflow-hidden rounded-full bg-canvas">
          <div
            className={cn(
              "absolute inset-y-0 left-0 rounded-full transition-[width] duration-500",
              over ? "bg-bad" : pct > 0.6 ? "bg-warn" : "bg-ok",
            )}
            style={{ width: `${pct * 100}%` }}
          />
        </div>
      ) : null}

      {probe.error ? (
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-bad">{probe.error}</p>
      ) : (
        <p className="mt-2.5 text-[11.5px] text-muted">
          Reference predicates land under 15,000 gas. You have{" "}
          {formatGasExact(probe.gasCap - probe.gasUsed)} to spare.
        </p>
      )}
    </div>
  );
}

function YamlSnippet({ taskId, subject }: { taskId: string; subject: string }) {
  const [copied, setCopied] = React.useState(false);
  const yaml = `tasks:
  - taskId: "${taskId}"
    subjects:
      - "${subject}"
    claimGasLimit: ${CLAIM_GAS_LIMIT}
    performGasLimit: ${PERFORM_GAS_LIMIT}
    payload: "0x"`;

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between">
        <span className="label-micro">keeper.yml</span>
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
          aria-label="Copy"
        >
          {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
        </button>
      </div>
      <pre className="table-scroll mt-1.5 rounded-[6px] border border-line bg-surface px-3 py-2.5 font-mono text-[11px] leading-relaxed text-muted">
        {yaml}
      </pre>
    </div>
  );
}

function Panel({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[9px] border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
        {note ? <span className="font-mono text-[11px] text-faint">{note}</span> : null}
      </div>
      <div className="px-4 py-4">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="label-micro">{label}</div>
      <div className="mt-1.5">{children}</div>
      {hint ? <div className="mt-1 text-[11px] text-faint">{hint}</div> : null}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
  truncate,
}: {
  label: string;
  value: string;
  mono?: boolean;
  truncate?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="label-micro">{label}</span>
      {truncate ? (
        <Hash value={value} head={8} tail={6} />
      ) : (
        <span
          className={cn("truncate text-[12px] text-fg", mono && "font-mono")}
          data-numeric
        >
          {value}
        </span>
      )}
    </div>
  );
}
