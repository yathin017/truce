import { pad, type Address, type Hex } from "viem";
import { coordinatorAbi } from "@truce/shared/abis";
import type { Clients } from "./clients.js";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

/** Encode an address subject as the coordinator's 32-byte subject key. */
export function subjectOf(addr: Address): Hex {
  return pad(addr, { size: 32 });
}

export interface TaskStats {
  claims: bigint;
  fulfilled: bigint;
  slashed: bigint;
  released: bigint;
}

export class CoordinatorReader {
  constructor(
    private readonly clients: Clients,
    private readonly address: Address,
  ) {}

  isEligible(taskId: Hex, subject: Hex): Promise<boolean> {
    return this.clients.publicClient.readContract({
      address: this.address,
      abi: coordinatorAbi,
      functionName: "isEligible",
      args: [taskId, subject],
    }) as Promise<boolean>;
  }

  holder(taskId: Hex, subject: Hex): Promise<Address> {
    return this.clients.publicClient.readContract({
      address: this.address,
      abi: coordinatorAbi,
      functionName: "holder",
      args: [taskId, subject],
    }) as Promise<Address>;
  }

  async taskStats(taskId: Hex): Promise<TaskStats> {
    const [claims, fulfilled, slashed, released] = (await this.clients.publicClient.readContract({
      address: this.address,
      abi: coordinatorAbi,
      functionName: "taskStats",
      args: [taskId],
    })) as [bigint, bigint, bigint, bigint];
    return { claims, fulfilled, slashed, released };
  }

  slashRate(stats: TaskStats): number {
    if (stats.claims === 0n) return 0;
    return Number((stats.slashed * 10_000n) / stats.claims) / 10_000;
  }
}
