import { parseEther, type Hex } from "viem";
import type { SafetyLimits } from "./types.js";
import type { CoordinatorReader, TaskStats } from "./coordinator.js";

export interface SafetyDecision {
  ok: boolean;
  reason?: string;
}

/**
 * Enforces the keeper's own risk limits. Default-safe: the operator must consciously
 * opt into risk. Some limits map to on-chain signals (slash rate); `onlyVerifiedTasks`
 * is approximated by "task is in the local curated deployment" until an on-chain
 * verified allowlist exists.
 */
export class SafetyChecker {
  private concurrentClaims = 0;
  private dailyExposureWei = 0n;

  constructor(
    private readonly limits: SafetyLimits,
    private readonly reader: CoordinatorReader,
    private readonly knownTaskIds: Set<string>,
  ) {}

  get dryRun(): boolean {
    return this.limits.dryRun;
  }

  async check(taskId: Hex, bondWei: bigint, stats: TaskStats): Promise<SafetyDecision> {
    if (this.limits.onlyVerifiedTasks && !this.knownTaskIds.has(taskId.toLowerCase())) {
      return { ok: false, reason: "task not in verified/known set" };
    }
    if (bondWei > parseEther(this.limits.maxBondPerClaim)) {
      return { ok: false, reason: `bond exceeds maxBondPerClaim (${this.limits.maxBondPerClaim})` };
    }
    if (this.concurrentClaims >= this.limits.maxConcurrentClaims) {
      return { ok: false, reason: "maxConcurrentClaims reached" };
    }
    if (this.dailyExposureWei + bondWei > parseEther(this.limits.maxDailyBondExposure)) {
      return { ok: false, reason: "maxDailyBondExposure would be exceeded" };
    }
    const rate = this.reader.slashRate(stats);
    if (rate > this.limits.maxTaskSlashRate) {
      return { ok: false, reason: `task slash rate ${(rate * 100).toFixed(1)}% over limit` };
    }
    return { ok: true };
  }

  onClaimSent(bondWei: bigint): void {
    this.concurrentClaims += 1;
    this.dailyExposureWei += bondWei;
  }

  onClaimSettled(): void {
    if (this.concurrentClaims > 0) this.concurrentClaims -= 1;
  }

  get exposureWei(): bigint {
    return this.dailyExposureWei;
  }
}
