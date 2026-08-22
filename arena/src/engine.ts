import type { Arena } from "./world.js";
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

/** Runs rounds, tracks running mean savings + cumulative burn, enforces the budget cap,
 *  drives the optional auto-loop, and fans events out to subscribers (WS). */
export class Engine {
  private roundSeq = 0;
  private spentWei = 0n;
  private gasPriceWei = 0n;
  private readonly recent: RoundRecord[] = [];
  private readonly laneAgg = new Map<LaneId, LaneAgg>();
  private readonly subs = new Set<Subscriber>();
  private autoTimer: NodeJS.Timeout | null = null;
  private busy = false;

  constructor(private readonly arena: Arena) {
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

  private get capWei(): bigint {
    return this.arena.cfg.budgetCapWei;
  }

  get budgetExhausted(): boolean {
    return this.spentWei >= this.capWei;
  }

  private spend = (wei: bigint): void => {
    this.spentWei += wei;
  };

  /** Run a single lane round if the budget allows. */
  async runLane(laneId: LaneId): Promise<RoundRecord | null> {
    if (this.budgetExhausted) {
      this.emit({ type: "budgetExhausted", budget: this.budget() });
      return null;
    }
    if (this.busy) return null;
    this.busy = true;
    const lane = this.arena.world.lanes[laneId];
    this.emit({ type: "roundStart", lane: laneId, laneLabel: lane.label, ts: Date.now() });
    try {
      const round = await runLaneRound(this.arena, laneId, ++this.roundSeq, this.spend);
      this.record(round);
      this.emit({ type: "round", round });
      this.emit({ type: "state", state: this.state() });
      return round;
    } catch (err) {
      this.emit({ type: "error", lane: laneId, message: (err as Error).message });
      return null;
    } finally {
      this.busy = false;
    }
  }

  /** Run all three lanes sequentially (bots reuse accounts, so lanes cannot overlap). */
  async runAll(): Promise<void> {
    for (const l of LANES) {
      if (this.budgetExhausted) break;
      await this.runLane(l);
    }
  }

  startAuto(): void {
    if (this.autoTimer) return;
    const tick = async () => {
      if (this.budgetExhausted) {
        this.stopAuto();
        this.emit({ type: "budgetExhausted", budget: this.budget() });
        return;
      }
      await this.runAll();
    };
    this.autoTimer = setInterval(() => void tick(), this.arena.cfg.autoIntervalMs);
    void tick();
  }

  stopAuto(): void {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
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
      budget: this.budget(),
      auto: { running: this.autoTimer !== null, intervalMs: this.arena.cfg.autoIntervalMs },
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
