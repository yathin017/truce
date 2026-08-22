import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { generatePrivateKey } from "viem/accounts";
import type { Hex } from "viem";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = join(__dirname, "..", "deployments");

/**
 * Load (or generate + persist) fresh, dedicated bot private keys for a chain.
 * Fresh keys avoid collisions with well-known/shared testnet accounts — some of which
 * carry EIP-7702 delegated code on Monad testnet and reject plain value transfers.
 * The keys file is gitignored; it holds throwaway testnet keys the deployer funds.
 */
export function loadOrCreateBotKeys(chainId: number, count = 4): Hex[] {
  const path = join(DEPLOY_DIR, `bot-keys-${chainId}.json`);
  if (existsSync(path)) {
    const keys = JSON.parse(readFileSync(path, "utf8")) as Hex[];
    if (keys.length >= count) return keys.slice(0, count);
  }
  const keys = Array.from({ length: count }, () => generatePrivateKey());
  mkdirSync(DEPLOY_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(keys, null, 2));
  console.log(`Generated ${count} fresh bot keys → ${path} (gitignored)`);
  return keys;
}
