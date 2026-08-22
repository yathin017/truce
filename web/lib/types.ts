// Mirrors the @truce/arena API shapes (see arena/README.md).

export type LaneId = "liquidation" | "arb" | "cron";
export type Side = "naive" | "coordinated";
export type TxRole = "liquidate" | "arb" | "harvest" | "claim" | "execute";

export interface TxRecord {
  side: Side;
  role: TxRole;
  hash: `0x${string}`;
  from: `0x${string}`;
  botIndex: number;
  gasLimit: string;
  gasUsed: string;
  gasBilledWei: string;
  gasPriceWei: string;
  success: boolean;
  explorerUrl: string;
}

export interface SideResult {
  txs: TxRecord[];
  declaredWei: string;
  gasReserved: string;
  winnerBot: number;
}

export interface RoundRecord {
  id: number;
  lane: LaneId;
  laneLabel: string;
  ts: number;
  naive: SideResult;
  coordinated: SideResult;
  savingsPct: number;
}

export interface LaneStats {
  id: LaneId;
  label: string;
  subject: `0x${string}`;
  taskId: `0x${string}`;
  naiveTarget: `0x${string}`;
  coordTarget: `0x${string}`;
  rounds: number;
  meanSavingsPct: number;
  cumulativeNaiveWei: string;
  cumulativeCoordWei: string;
}

export interface ArenaState {
  chainId: number;
  coordinator: `0x${string}`;
  explorerBase: string;
  gasPriceWei: string;
  bots: `0x${string}`[];
  busy: boolean;
  runningLane: LaneId | null;
  budget: { capWei: string; spentWei: string; remainingWei: string };
  overall: { rounds: number; meanSavingsPct: number; cumulativeNaiveWei: string; cumulativeCoordWei: string };
  lanes: LaneStats[];
  recentRounds: RoundRecord[];
}

export type ArenaEvent =
  | { type: "roundStart"; lane: LaneId; laneLabel: string; ts: number }
  | { type: "round"; round: RoundRecord }
  | { type: "state"; state: ArenaState }
  | { type: "budgetExhausted"; budget: ArenaState["budget"] }
  | { type: "error"; lane?: LaneId; message: string };

export const LANE_ORDER: LaneId[] = ["liquidation", "arb", "cron"];

export const LANE_META: Record<LaneId, { short: string; blurb: string; opportunity: string; reverts: string }> = {
  liquidation: {
    short: "Liquidation",
    blurb: "An Aave-style loan goes underwater. Keepers race to liquidate it for a reward.",
    opportunity: "Health factor < 1",
    reverts: "position already liquidated",
  },
  arb: {
    short: "DEX arbitrage",
    blurb: "A pool price drifts off the oracle. Keepers race to arbitrage it back.",
    opportunity: "Price gap > 1%",
    reverts: "price already corrected",
  },
  cron: {
    short: "Cron / upkeep",
    blurb: "A scheduled job comes due. Keepers race to run it. Zero MEV — funded by a bounty.",
    opportunity: "Interval elapsed",
    reverts: "job already run",
  },
};
