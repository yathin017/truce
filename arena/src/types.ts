import type { Address, Hex } from "viem";

export type LaneId = "liquidation" | "arb" | "cron";
export type Side = "naive" | "coordinated";
export type TxRole = "liquidate" | "arb" | "harvest" | "claim" | "execute";

export interface TxRecord {
  side: Side;
  role: TxRole;
  hash: Hex;
  from: Address;
  botIndex: number;
  gasLimit: string; // declared limit
  gasUsed: string; // receipt gasUsed (equals limit on Monad reverts)
  gasBilledWei: string; // gasLimit × effectiveGasPrice — what Monad bills
  gasPriceWei: string;
  success: boolean;
  explorerUrl: string;
}

export interface SideResult {
  txs: TxRecord[];
  declaredWei: string; // Σ gasLimit × price (Monad basis)
  gasReserved: string; // Σ gasLimit
  winnerBot: number; // botIndex that landed, or -1
}

export interface RoundRecord {
  id: number;
  lane: LaneId;
  laneLabel: string;
  ts: number;
  naive: SideResult;
  coordinated: SideResult;
  savingsPct: number; // (naive − coord) / naive × 100
}

export interface LaneStats {
  id: LaneId;
  label: string;
  subject: Hex;
  taskId: Hex;
  naiveTarget: Address;
  coordTarget: Address;
  rounds: number;
  meanSavingsPct: number;
  cumulativeNaiveWei: string;
  cumulativeCoordWei: string;
}

export interface Budget {
  capWei: string;
  spentWei: string;
  remainingWei: string;
}

export interface ArenaState {
  chainId: number;
  coordinator: Address;
  explorerBase: string;
  gasPriceWei: string;
  bots: Address[];
  busy: boolean;
  runningLane: LaneId | null;
  budget: Budget;
  overall: { rounds: number; meanSavingsPct: number; cumulativeNaiveWei: string; cumulativeCoordWei: string };
  lanes: LaneStats[];
  recentRounds: RoundRecord[];
}

export type ArenaEvent =
  | { type: "roundStart"; lane: LaneId; laneLabel: string; ts: number }
  | { type: "round"; round: RoundRecord }
  | { type: "state"; state: ArenaState }
  | { type: "budgetExhausted"; budget: Budget }
  | { type: "error"; lane?: LaneId; message: string };
