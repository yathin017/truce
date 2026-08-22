import { getAddress, type Address, type Hex } from "viem";
import { formatMon } from "@reservoir/shared";
import type { Clients } from "./clients.js";
import type { KeeperConfig, TaskConfig } from "./types.js";
import { CoordinatorReader, subjectOf, ZERO_ADDRESS } from "./coordinator.js";
import { SafetyChecker } from "./safety.js";
import { GasLedger } from "./gas.js";
import { reserve, perform } from "./executor.js";
import { Logger } from "./log.js";

export type Outcome = "won" | "stood-down" | "lost-race" | "skipped" | "ineligible" | "dry-run";

/** One keeper: its clients, executor, safety limits, and gas ledger. */
export class Keeper {
  readonly reader: CoordinatorReader;
  readonly safety: SafetyChecker;
  readonly gas = new GasLedger();
  readonly me: Address;
  private readonly stable = new Map<string, number>();
  private stopped = false;

  constructor(
    readonly cfg: KeeperConfig,
    readonly clients: Clients,
    knownTaskIds: Set<string>,
    readonly log: Logger,
    private readonly coordinator: Address,
    private readonly executor: Address,
    private readonly bondWei: bigint,
  ) {
    this.reader = new CoordinatorReader(clients, coordinator);
    this.safety = new SafetyChecker(cfg.safety, this.reader, knownTaskIds);
    this.me = clients.account.address;
  }

  private subjectsFor(task: TaskConfig): Hex[] {
    if (task.subjects === "auto") {
      this.log.warn(`task ${task.taskId.slice(0, 10)}: subjects: auto not supported; skipping`);
      return [];
    }
    return task.subjects.map((a) => subjectOf(getAddress(a)));
  }

  /** Try to act on a single (task, subject). Returns what happened. */
  async attempt(task: TaskConfig, subject: Hex): Promise<Outcome> {
    const short = `${task.taskId.slice(0, 10)}…/${subject.slice(0, 10)}…`;

    if (!(await this.reader.isEligible(task.taskId, subject))) {
      this.stable.set(subject, 0);
      return "ineligible";
    }

    // Stand-down: a live rival already holds the exclusive claim. THIS is the product.
    const holder = await this.reader.holder(task.taskId, subject);
    if (holder !== ZERO_ADDRESS && getAddress(holder) !== getAddress(this.executor)) {
      this.log.standDown(`${short}: held by ${holder.slice(0, 10)}… — standing down`);
      return "stood-down";
    }

    const n = (this.stable.get(subject) ?? 0) + 1;
    this.stable.set(subject, n);
    if (n < this.cfg.safety.requireStableEligible) return "skipped";

    const stats = await this.reader.taskStats(task.taskId);
    const decision = await this.safety.check(task.taskId, this.bondWei, stats);
    if (!decision.ok) {
      this.log.warn(`${short}: safety blocked — ${decision.reason}`);
      return "skipped";
    }

    if (this.safety.dryRun) {
      this.log.info(`${short}: DRY-RUN would claim (bond ${formatMon(this.bondWei)}, gas ${task.claimGasLimit})`);
      return "dry-run";
    }

    return this.claimAndExecute(task, subject, short);
  }

  private async claimAndExecute(task: TaskConfig, subject: Hex, short: string): Promise<Outcome> {
    this.safety.onClaimSent(this.bondWei);
    try {
      const claimTx = await reserve(
        this.clients,
        this.executor,
        task.taskId,
        subject,
        this.bondWei,
        BigInt(task.claimGasLimit),
      );
      const claimPrice = claimTx.receipt.effectiveGasPrice;
      const claimOk = claimTx.receipt.status === "success";
      this.gas.add({
        kind: "claim",
        keeper: this.me,
        gasLimit: claimTx.gasLimit,
        gasUsed: claimTx.receipt.gasUsed,
        gasPrice: claimPrice,
        success: claimOk,
      });

      if (!claimOk) {
        this.log.standDown(`${short}: lost the claim race (cheap ${formatMon(claimTx.gasLimit * claimPrice)})`);
        return "lost-race";
      }
      this.log.win(`${short}: won claim`);

      const performTx = await perform(
        this.clients,
        this.executor,
        task.taskId,
        subject,
        task.payload ?? "0x",
        BigInt(task.performGasLimit),
      );
      this.gas.add({
        kind: "perform",
        keeper: this.me,
        gasLimit: performTx.gasLimit,
        gasUsed: performTx.receipt.gasUsed,
        gasPrice: performTx.receipt.effectiveGasPrice,
        success: performTx.receipt.status === "success",
      });
      this.log.win(`${short}: executed (gas used ${performTx.receipt.gasUsed})`);
      return "won";
    } catch (err) {
      // A revert here is the cheap-loss path — the claim tx still cost only its tight limit.
      this.log.standDown(`${short}: claim reverted (rival won) — ${(err as Error).message.slice(0, 60)}`);
      return "lost-race";
    } finally {
      this.safety.onClaimSettled();
    }
  }

  async pollOnce(): Promise<void> {
    for (const task of this.cfg.tasks) {
      for (const subject of this.subjectsFor(task)) {
        await this.attempt(task, subject);
      }
    }
  }

  stop(): void {
    this.stopped = true;
  }

  async run(): Promise<void> {
    this.log.info(`daemon up · coordinator ${this.coordinator.slice(0, 10)}… · executor ${this.executor.slice(0, 10)}…`);
    while (!this.stopped) {
      try {
        await this.pollOnce();
      } catch (err) {
        this.log.fail(`poll error: ${(err as Error).message}`);
      }
      await new Promise((r) => setTimeout(r, this.cfg.pollIntervalMs));
    }
  }
}
