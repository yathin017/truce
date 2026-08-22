import { parseEther, type Chain, type Hex } from "viem";
import { privateKeyToAccount, mnemonicToAccount } from "viem/accounts";
import { anvil, monadTestnet } from "@reservoir/shared";

export interface ArenaConfig {
  chainId: number;
  chain: Chain;
  rpc: string;
  explorerBase: string;
  deployerKey: Hex;
  botKeys: Hex[];
  botFundingWei: bigint; // top up each bot to this on bootstrap (non-anvil)
  budgetCapWei: bigint; // hard stop for total spend this session
  autoIntervalMs: number;
  port: number;
}

const ANVIL_DEPLOYER = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
const ANVIL_BOTS: Hex[] = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
];

function env(name: string): string | undefined {
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

/** Resolve config for a chain. Anvil uses well-known keys; other chains use env. */
export function loadConfig(chainId: number): ArenaConfig {
  const isAnvil = chainId === anvil.id;
  const chain = chainId === monadTestnet.id ? monadTestnet : anvil;
  const rpc =
    env("ARENA_RPC") ??
    (chainId === monadTestnet.id ? "https://testnet-rpc.monad.xyz" : "http://127.0.0.1:8545");
  const explorerBase = chain.blockExplorers?.default.url ?? "";

  let deployerKey: Hex;
  let botKeys: Hex[];
  if (isAnvil) {
    deployerKey = ANVIL_DEPLOYER;
    botKeys = ANVIL_BOTS;
  } else {
    const dk = env("DEPLOYER_PRIVATE_KEY");
    if (!dk) throw new Error(`chain ${chainId} requires DEPLOYER_PRIVATE_KEY`);
    deployerKey = (dk.startsWith("0x") ? dk : `0x${dk}`) as Hex;
    // Bots: derive 4 accounts from ARENA_MNEMONIC, or fall back to explicit KEEPER keys.
    const mnemonic = env("ARENA_MNEMONIC");
    if (mnemonic) {
      botKeys = [0, 1, 2, 3].map((i) => mnemonicToAccount(mnemonic, { addressIndex: i }).getHdKey().privateKey!)
        .map((b) => `0x${Buffer.from(b).toString("hex")}` as Hex);
    } else {
      botKeys = [1, 2, 3, 4].map((i) => {
        const k = env(`KEEPER_PRIVATE_KEY_${i}`);
        if (!k) throw new Error(`set ARENA_MNEMONIC or KEEPER_PRIVATE_KEY_1..4 for chain ${chainId}`);
        return (k.startsWith("0x") ? k : `0x${k}`) as Hex;
      });
    }
  }

  return {
    chainId,
    chain,
    rpc,
    explorerBase,
    deployerKey,
    botKeys,
    botFundingWei: parseEther(env("ARENA_BOT_FUNDING") ?? "3"),
    budgetCapWei: parseEther(env("ARENA_BUDGET_MON") ?? (isAnvil ? "1000000" : "15")),
    autoIntervalMs: Number(env("ARENA_INTERVAL_MS") ?? 10_000),
    port: Number(env("ARENA_PORT") ?? 8787),
  };
}

/** Accounts derived from keys. */
export function accountsFor(cfg: ArenaConfig) {
  return {
    deployer: privateKeyToAccount(cfg.deployerKey),
    bots: cfg.botKeys.map((k) => privateKeyToAccount(k)),
  };
}
