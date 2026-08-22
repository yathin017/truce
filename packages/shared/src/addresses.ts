import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { Address, Hex } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOYMENTS_DIR = join(__dirname, "..", "deployments");

export interface TaskDeployment {
  taskId: Hex;
  predicate: Address;
  executor?: Address;
  label: string;
}

export interface Deployment {
  chainId: number;
  coordinator: Address;
  mockPool?: Address;
  mockOracle?: Address;
  mockVault?: Address;
  tasks: Record<string, TaskDeployment>;
}

/**
 * Load a deployment written by the Foundry deploy script.
 * Deploy scripts write `packages/shared/deployments/<chainId>.json`.
 * Returns null if not yet deployed on that chain.
 */
export function loadDeployment(chainId: number): Deployment | null {
  const path = join(DEPLOYMENTS_DIR, `${chainId}.json`);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as Deployment;
}

export function requireDeployment(chainId: number): Deployment {
  const d = loadDeployment(chainId);
  if (!d) throw new Error(`No deployment found for chainId ${chainId} (run the deploy script first)`);
  return d;
}
