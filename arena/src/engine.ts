import { prepareArenaForExperiment, type Arena } from "./world.js";
import { runLaneRound } from "./lane.js";
import type { ArenaEvent, ArenaState, LaneId, LaneStats, RoundRecord } from "./types.js";

const LANES: LaneId[] = ["liquidation", "arb", "cron"];
const RECENT = 30;

interface LaneAgg {
  rounds: number;
  sumSavings: number;
  cumNaiveWei: bigint;
  cumCoordWei: bigint;
}

type Subscriber = (e: ArenaEvent) => void;
type LaneRunner = typeof runLaneRound;
type ArenaPreparer = typeof prepareArenaForExperiment;

/** Runs explicitly requested rounds, tracks savings + cumulative burn, enforces the budget cap,
 *  prevents overlapping transactions, and fans events out to subscribers (WS). */
export class Engine {
  private roundSeq = 0;
  private spentWei = 0n;
  private gasPriceWei = 0n;
  private readonly recent: RoundRecord[] = [];
  private readonly laneAgg = new Map<LaneId, LaneAgg>();
  private readonly subs = new Set<Subscriber>();
  private activeLane: LaneId | null = null;
  private sequenceRunning = false;

  constructor(
    private readonly arena: Arena,
    private readonly laneRunner: LaneRunner = runLaneRound,
    private readonly prepareArena: ArenaPreparer = prepareArenaForExperiment,
  ) {
    for (const l of LANES) this.laneAgg.set(l, { rounds: 0, sumSavings: 0, cumNaiveWei: 0n, cumCoordWei: 0n });
  }

  async init(): Promise<void> {
    this.gasPriceWei = await this.arena.deployer.publicClient.getGasPrice();
  }

  subscribe(cb: Subscriber): () => void {
    this.subs.add(cb);
    return () => this.subs.delete(cb);
  }

  private emit(e: ArenaEvent): void {
    for (const cb of this.subs) cb(e);
  }

  private emitState(): void {
    this.emit({ type: "state", state: this.state() });
  }

  private get capWei(): bigint {
    return this.arena.cfg.budgetCapWei;
  }

  get budgetExhausted(): boolean {
    return this.spentWei >= this.capWei;
  }

  get busy(): boolean {
    return this.sequenceRunning || this.activeLane !== null;
  }

  get canRunManual(): boolean {
    return !this.busy && !this.budgetExhausted;
  }

  private spend = (wei: bigint): void => {
    this.spentWei += wei;
  };

  private async runLaneOnce(laneId: LaneId): Promise<RoundRecord | null> {
    if (this.budgetExhausted) {
      this.emit({ type: "budgetExhausted", budget: this.budget() });
      return null;
    }
    this.activeLane = laneId;
    const lane = this.arena.world.lanes[laneId];
    this.emit({ type: "roundStart", lane: laneId, laneLabel: lane.label, ts: Date.now() });
    this.emitState();
    try {
      const round = await this.laneRunner(this.arena, laneId, ++this.roundSeq, this.spend);
      this.record(round);
      this.emit({ type: "round", round });
      return round;
    } catch (err) {
      this.emit({ type: "error", lane: laneId, message: (err as Error).message });
      return null;
    } finally {
      this.activeLane = null;
      this.emitState();
    }
  }

  /** Run all three lanes sequentially for one explicit experiment request. */
  async runAll(): Promise<boolean> {
    if (!this.canRunManual) {
      if (this.budgetExhausted) this.emit({ type: "budgetExhausted", budget: this.budget() });
      return false;
    }
    return this.runSequence();
  }

  private async runSequence(): Promise<boolean> {
    if (this.busy) return false;
    this.sequenceRunning = true;
    this.emitState();
    try {
      await this.prepareArena(this.arena);
      let completed = true;
      for (const laneId of LANES) {
        if (this.budgetExhausted) {
          this.emit({ type: "budgetExhausted", budget: this.budget() });
          completed = false;
          break;
        }
        if (!(await this.runLaneOnce(laneId))) completed = false;
      }
      return completed;
    } catch (err) {
      this.emit({ type: "error", message: `experiment setup failed: ${(err as Error).message}` });
      return false;
    } finally {
      this.sequenceRunning = false;
      this.emitState();
    }
  }

  private record(r: RoundRecord): void {
    const agg = this.laneAgg.get(r.lane)!;
    agg.rounds += 1;
    agg.sumSavings += r.savingsPct;
    agg.cumNaiveWei += BigInt(r.naive.declaredWei);
    agg.cumCoordWei += BigInt(r.coordinated.declaredWei);
    this.recent.unshift(r);
    if (this.recent.length > RECENT) this.recent.pop();
  }

  private budget() {
    const remaining = this.capWei > this.spentWei ? this.capWei - this.spentWei : 0n;
    return { capWei: this.capWei.toString(), spentWei: this.spentWei.toString(), remainingWei: remaining.toString() };
  }

  private laneStats(): LaneStats[] {
    return LANES.map((id) => {
      const lane = this.arena.world.lanes[id];
      const agg = this.laneAgg.get(id)!;
      return {
        id,
        label: lane.label,
        subject: lane.subject,
        taskId: lane.taskId,
        naiveTarget: lane.naiveTarget,
        coordTarget: lane.coordTarget,
        rounds: agg.rounds,
        meanSavingsPct: agg.rounds ? agg.sumSavings / agg.rounds : 0,
        cumulativeNaiveWei: agg.cumNaiveWei.toString(),
        cumulativeCoordWei: agg.cumCoordWei.toString(),
      };
    });
  }

  state(): ArenaState {
    let rounds = 0;
    let sumSavings = 0;
    let cumNaive = 0n;
    let cumCoord = 0n;
    for (const agg of this.laneAgg.values()) {
      rounds += agg.rounds;
      sumSavings += agg.sumSavings;
      cumNaive += agg.cumNaiveWei;
      cumCoord += agg.cumCoordWei;
    }
    return {
      chainId: this.arena.cfg.chainId,
      coordinator: this.arena.world.coordinator,
      explorerBase: this.arena.cfg.explorerBase,
      gasPriceWei: this.gasPriceWei.toString(),
      bots: this.arena.world.bots,
      busy: this.busy,
      runningLane: this.activeLane,
      budget: this.budget(),
      overall: {
        rounds,
        meanSavingsPct: rounds ? sumSavings / rounds : 0,
        cumulativeNaiveWei: cumNaive.toString(),
        cumulativeCoordWei: cumCoord.toString(),
      },
      lanes: this.laneStats(),
      recentRounds: this.recent,
    };
  }
}
