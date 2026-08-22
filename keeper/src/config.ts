import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { getAddress, isHex, type Address, type Hex } from "viem";
import { loadDeployment } from "@reservoir/shared";
import type { KeeperConfig, SafetyLimits, TaskConfig } from "./types.js";

const DEFAULT_SAFETY: SafetyLimits = {
  maxBondPerClaim: "0.05",
  maxConcurrentClaims: 5,
  maxDailyBondExposure: "1.0",
  onlyVerifiedTasks: true,
  minTaskAgeBlocks: 0,
  maxTaskSlashRate: 0.1,
  requireStableEligible: 1,
  dryRun: false,
};

/** Replace ${VAR} with process.env.VAR, throwing if unset. */
function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/gi, (_, name: string) => {
    const v = process.env[name];
    if (v === undefined || v === "") throw new Error(`Config references unset env var: ${name}`);
    return v;
  });
}

function asHex(value: unknown, field: string): Hex {
  const s = typeof value === "string" ? expandEnv(value) : "";
  if (!isHex(s)) throw new Error(`Config field ${field} must be 0x-hex, got: ${String(value)}`);
  return s;
}

export function loadConfig(path: string): KeeperConfig {
  const raw = parseYaml(readFileSync(path, "utf8")) as Record<string, unknown>;

  if (typeof raw.rpc !== "string") throw new Error("config.rpc (string) is required");
  if (typeof raw.chainId !== "number") throw new Error("config.chainId (number) is required");

  const account = asHex(raw.account, "account");
  const safety: SafetyLimits = { ...DEFAULT_SAFETY, ...(raw.safety as object | undefined) };

  const tasksRaw = Array.isArray(raw.tasks) ? raw.tasks : [];
  const tasks: TaskConfig[] = tasksRaw.map((t: Record<string, unknown>, i) => {
    const taskId = asHex(t.taskId, `tasks[${i}].taskId`);
    const subjects: Address[] | "auto" =
      t.subjects === "auto"
        ? "auto"
        : (Array.isArray(t.subjects) ? t.subjects : []).map((s) => getAddress(String(s)));
    return {
      taskId,
      subjects,
      claimGasLimit: typeof t.claimGasLimit === "number" ? t.claimGasLimit : 60_000,
      performGasLimit: typeof t.performGasLimit === "number" ? t.performGasLimit : 500_000,
      payload: t.payload ? asHex(t.payload, `tasks[${i}].payload`) : "0x",
    };
  });

  let coordinator = raw.coordinator ? getAddress(String(raw.coordinator)) : undefined;
  if (!coordinator) {
    const dep = loadDeployment(raw.chainId);
    if (dep) coordinator = dep.coordinator;
  }

  return {
    rpc: expandEnv(raw.rpc),
    chainId: raw.chainId,
    account,
    coordinator,
    executor: raw.executor ? getAddress(String(raw.executor)) : undefined,
    label: typeof raw.label === "string" ? raw.label : undefined,
    pollIntervalMs: typeof raw.pollIntervalMs === "number" ? raw.pollIntervalMs : 1_000,
    safety,
    tasks,
  };
}
