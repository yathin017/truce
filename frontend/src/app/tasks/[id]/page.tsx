"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Braces,
  Check,
  Lock,
  Radio,
  Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMon } from "@/lib/gas";
import {
  CLAIM_GAS_LIMIT,
  MONAD_TESTNET,
  PREDICATE_GAS_CAP,
  SLASH_REWARD_WEI,
  explorerAddress,
} from "@/lib/chain";
import { describeCheckParam } from "@/lib/encoding";
import { assessTrust } from "@/lib/trust";
import {
  DEPLOYMENT,
  HEAD_BLOCK,
  computeTaskId,
  getSubjects,
  getTask,
  getTaskEvents,
  reserveClaim,
  resolveClaim,
} from "@/services/truce";
import type { CoordinatorEvent, SubjectRow, Task } from "@/types/truce";
import { Button } from "@/components/ui/button";
import { MonValue, Readout } from "@/components/instrument/MonValue";
import { TrustBadge, TrustBreakdown } from "@/components/instrument/TrustBadge";
import { Hash, AddressLink } from "@/components/instrument/Mono";
import { BlockCountdown, WindowLabel } from "@/components/instrument/BlockCountdown";
import { EventFeed } from "@/components/instrument/EventFeed";
import { EmptyRow, ScrollTable, Td, Th, Tr } from "@/components/instrument/Table";

export default function TaskDetailPage() {
  const params = useParams<{ id: string }>();
  const taskId = params.id;

  const [task, setTask] = React.useState<Task | null | undefined>(undefined);
  const [subjects, setSubjects] = React.useState<SubjectRow[]>([]);
  const [events, setEvents] = React.useState<CoordinatorEvent[]>([]);
  const [block, setBlock] = React.useState(HEAD_BLOCK);
  const [pending, setPending] = React.useState<string | null>(null);

  React.useEffect(() => {
    getTask(taskId).then(setTask);
    getSubjects(taskId).then(setSubjects);
    getTaskEvents(taskId).then(setEvents);
  }, [taskId]);

  React.useEffect(() => {
    const id = window.setInterval(
      () => setBlock((b) => b + 1),
      MONAD_TESTNET.blockMs * 4,
    );
    return () => window.clearInterval(id);
  }, []);

  if (task === undefined) {
    return <div className="px-4 py-7 text-[13px] text-faint lg:px-7">Reading task…</div>;
  }

  if (task === null) {
    return (
      <div className="px-4 py-16 text-center lg:px-7">
        <p className="text-[14px] text-fg">No task registered under this id.</p>
        <Button asChild variant="outline" size="sm" className="mt-4">
          <Link href="/tasks">Back to tasks</Link>
        </Button>
      </div>
    );
  }

  const trust = assessTrust(task);
  const derived = computeTaskId(task.params);
  const derivationMatches = derived.toLowerCase() === task.taskId.toLowerCase();

  const act = async (key: string, fn: () => Promise<unknown>) => {
    setPending(key);
    await fn();
    setPending(null);
  };

  return (
    <div className="px-4 py-7 lg:px-7">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-1.5 text-[12.5px] text-faint transition-colors hover:text-fg"
      >
        <ArrowLeft className="size-3.5" />
        Tasks
      </Link>

      {/* Header */}
      <header className="mt-3 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="label-micro">{task.category}</span>
            <span
              className={cn(
                "inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em]",
                task.enforced ? "text-ok" : "text-faint",
              )}
            >
              {task.enforced ? <Lock className="size-2.5" /> : <Unlock className="size-2.5" />}
              {task.enforced ? "enforced" : "voluntary"}
            </span>
            {!task.params.active ? (
              <span className="rounded-[4px] border border-warn/40 bg-warn/10 px-2 py-[3px] font-mono text-[9.5px] uppercase tracking-[0.14em] text-warn">
                deactivated
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-[26px] font-semibold tracking-[-0.02em] text-fg">
            {task.label}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
            <Hash value={task.taskId} head={14} tail={8} />
            <span className="font-mono text-[11.5px] text-faint" data-numeric>
              registered #{task.registeredAtBlock.toLocaleString("en-US")} · {task.ageDays}d ago
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <TrustBadge tier={trust.tier} />
          <Button asChild variant="primary" size="sm">
            <Link href={`/keeper?task=${task.taskId}`}>
              <Radio />
              Run a keeper on this task
            </Link>
          </Button>
        </div>
      </header>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 space-y-5">
          {/* Immutable tuple */}
          <section className="rounded-[9px] border border-line bg-panel">
            <SectionHead
              title="Immutable parameters"
              note="These six fields ARE the task — the id is their hash."
            />
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-4 py-4 md:grid-cols-3">
              <Readout label="predicate">
                <AddressLink address={task.params.predicate} />
              </Readout>
              <Readout
                label="checkParam"
                hint={describeCheckParam(task.checkParamShape, task.params.checkParam)}
              >
                <Hash value={task.params.checkParam} head={10} tail={6} />
              </Readout>
              <Readout label="window">
                <WindowLabel blocks={task.params.windowBlocks} />
              </Readout>
              <Readout label="bond" hint="Locked on claim, slashable on failure">
                <MonValue wei={task.params.bondWei} />
              </Readout>
              <Readout
                label="bounty / job"
                hint={
                  task.params.bountyPerJob > 0n
                    ? "Paid from escrow on consume"
                    : "Keeper is paid by the MEV of the job itself"
                }
              >
                {task.params.bountyPerJob > 0n ? (
                  <MonValue wei={task.params.bountyPerJob} tone="ok" />
                ) : (
                  <span className="font-mono text-[13px] text-faint">0 — self-funding</span>
                )}
              </Readout>
              <Readout label="sponsor">
                <AddressLink address={task.params.sponsor} />
              </Readout>
            </div>

            {/* Derivation proof */}
            <div className="border-t border-line px-4 py-3.5">
              <div className="flex items-center gap-2">
                <Braces className="size-3.5 text-faint" />
                <span className="label-micro">taskId derivation</span>
                {derivationMatches ? (
                  <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.12em] text-ok">
                    <Check className="size-3" />
                    matches
                  </span>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-bad">
                    mismatch
                  </span>
                )}
              </div>
              <pre className="table-scroll mt-2.5 rounded-[6px] border border-line bg-surface px-3 py-2.5 font-mono text-[11.5px] leading-relaxed text-muted">
{`keccak256(abi.encode(
  predicate     ${task.params.predicate},
  checkParam    ${task.params.checkParam},
  windowBlocks  ${task.params.windowBlocks},
  bondWei       ${task.params.bondWei},
  bountyPerJob  ${task.params.bountyPerJob},
  sponsor       ${task.params.sponsor}
)) = ${task.taskId}`}
              </pre>
              <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
                Nothing about a task can be edited. Changing any field produces a
                different id and therefore a different task — the sponsor can only
                fund, deactivate or withdraw.
              </p>
            </div>
          </section>

          {/* Subjects */}
          <section>
            <SectionHead
              title="Subjects"
              note="isEligible(taskId, subject) · holder(taskId, subject)"
              bare
            />
            <ScrollTable className="mt-2.5">
              <thead>
                <tr>
                  <Th>subject</Th>
                  <Th>readout</Th>
                  <Th>eligible</Th>
                  <Th>holder</Th>
                  <Th>window left</Th>
                  <Th align="right">action</Th>
                </tr>
              </thead>
              <tbody>
                {subjects.length === 0 ? (
                  <EmptyRow colSpan={6}>No subjects tracked for this task.</EmptyRow>
                ) : (
                  subjects.map((s) => {
                    const expired = s.claim ? s.claim.expiryBlock <= block : false;
                    const key = s.subject;
                    return (
                      <Tr
                        key={key}
                        highlight={s.eligible && !s.holder ? "bad" : undefined}
                      >
                        <Td>
                          <div className="font-mono text-[12px] text-fg">{s.label}</div>
                          <div className="mt-0.5">
                            <AddressLink address={s.address} copyable={false} />
                          </div>
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              "font-mono text-[12.5px]",
                              s.metricTone === "ok" && "text-ok",
                              s.metricTone === "warn" && "text-warn",
                              s.metricTone === "bad" && "text-bad",
                              s.metricTone === "neutral" && "text-muted",
                            )}
                            data-numeric
                          >
                            {s.metric}
                          </span>
                        </Td>
                        <Td>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.1em]",
                              s.eligible ? "text-bad" : "text-faint",
                            )}
                          >
                            <span
                              className={cn(
                                "size-1.5 rounded-full",
                                s.eligible
                                  ? "animate-[truce-pulse_1.4s_ease-in-out_infinite] bg-bad"
                                  : "bg-line-strong",
                              )}
                            />
                            {s.eligible ? "true" : "false"}
                          </span>
                        </Td>
                        <Td>
                          {s.holder ? (
                            <AddressLink address={s.holder} copyable={false} />
                          ) : (
                            <span className="font-mono text-[12px] text-faint">unclaimed</span>
                          )}
                        </Td>
                        <Td>
                          {s.claim ? (
                            <BlockCountdown
                              expiryBlock={s.claim.expiryBlock}
                              currentBlock={block}
                              windowBlocks={task.params.windowBlocks}
                            />
                          ) : (
                            <span className="font-mono text-[12px] text-faint">—</span>
                          )}
                        </Td>
                        <Td align="right">
                          {s.claim && expired ? (
                            <Button
                              size="sm"
                              variant="danger"
                              disabled={pending === key}
                              onClick={() =>
                                act(key, () => resolveClaim(task.taskId, s.subject))
                              }
                            >
                              {pending === key
                                ? "resolving…"
                                : `resolve · +${formatMon(SLASH_REWARD_WEI, 3)} MON`}
                            </Button>
                          ) : s.holder ? (
                            <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-faint">
                              rights held
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant={s.eligible ? "primary" : "outline"}
                              disabled={!s.eligible || pending === key}
                              onClick={() =>
                                act(key, () => reserveClaim(task.taskId, s.subject))
                              }
                            >
                              {pending === key
                                ? "claiming…"
                                : `claim · ${formatMon(task.params.bondWei, 3)} MON`}
                            </Button>
                          )}
                        </Td>
                      </Tr>
                    );
                  })
                )}
              </tbody>
            </ScrollTable>
            <p className="mt-2 text-[11.5px] leading-relaxed text-faint">
              A claim declares {CLAIM_GAS_LIMIT.toLocaleString("en-US")} gas, not the
              ~500,000 the job itself needs. That gap is the whole point. The
              predicate staticcall is capped at {PREDICATE_GAS_CAP.toLocaleString("en-US")}{" "}
              gas and fails closed.
            </p>
          </section>

          {/* History */}
          <section className="rounded-[9px] border border-line bg-panel">
            <SectionHead title="Event stream" note="Claimed · Consumed · Resolved" />
            <EventFeed events={events} />
          </section>
        </div>

        {/* Rail */}
        <aside className="space-y-5">
          <section className="rounded-[9px] border border-line bg-panel">
            <SectionHead title="Settlement record" />
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 px-4 py-4">
              <Readout label="claims">
                <span className="font-mono text-[17px] text-fg" data-numeric>
                  {task.stats.claims}
                </span>
              </Readout>
              <Readout label="fulfilled">
                <span className="font-mono text-[17px] text-ok" data-numeric>
                  {task.stats.fulfilled}
                </span>
              </Readout>
              <Readout label="slashed" hint="claimed, then failed to act">
                <span
                  className={cn(
                    "font-mono text-[17px]",
                    task.stats.slashed > 0 ? "text-bad" : "text-faint",
                  )}
                  data-numeric
                >
                  {task.stats.slashed}
                </span>
              </Readout>
              <Readout label="released" hint="predicate false at expiry — refunded">
                <span className="font-mono text-[17px] text-muted" data-numeric>
                  {task.stats.released}
                </span>
              </Readout>
            </div>
            <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t border-line px-4 py-4">
              <Readout label="escrow">
                <MonValue wei={task.escrowWei} size="sm" />
              </Readout>
              <Readout label="reserved" hint="backing live claims">
                <MonValue wei={task.reservedEscrowWei} size="sm" tone="muted" />
              </Readout>
              <Readout label="keeper P&L" className="col-span-2">
                <MonValue wei={task.realisedKeeperPnlWei} tone="auto" signed />
              </Readout>
            </div>
          </section>

          <TrustBreakdown assessment={trust} />

          <section className="rounded-[9px] border border-line bg-panel px-4 py-4">
            <div className="label-micro">predicate contract</div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
              The coordinator only ever asks this contract one question:{" "}
              <code className="font-mono text-[11.5px] text-fg">
                isEligible(subject, checkParam)
              </code>{" "}
              → bool. It has no idea what a liquidation is.
            </p>
            <a
              href={explorerAddress(MONAD_TESTNET, task.params.predicate)}
              target="_blank"
              rel="noreferrer"
              className="mt-3 inline-flex text-[12.5px] text-accent hover:underline"
            >
              Read the source →
            </a>
            <p className="mt-3 border-t border-line pt-3 font-mono text-[11px] text-faint">
              deployment: {DEPLOYMENT.source}
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHead({
  title,
  note,
  bare,
}: {
  title: string;
  note?: string;
  bare?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1",
        !bare && "border-b border-line px-4 py-3",
      )}
    >
      <h2 className="text-[13.5px] font-semibold tracking-[-0.01em] text-fg">{title}</h2>
      {note ? <span className="font-mono text-[11px] text-faint">{note}</span> : null}
    </div>
  );
}
