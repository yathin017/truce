import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { parseEther, formatEther, type Address, type Hex } from "viem";
import {
  coordinatorAbi,
  enforcedMockPoolAbi,
  mockArbPoolAbi,
  mockCronJobAbi,
} from "@truce/shared/abis";
import type { ArenaConfig } from "./config.js";
import { accountsFor } from "./config.js";
import { makeClients, deployContract, send, read, type BotClients } from "./chain.js";
import { subjectFromAddress, packPriceParam, uintToBytes32 } from "./encoding.js";
import type { LaneId } from "./types.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEPLOY_DIR = join(__dirname, "..", "deployments");

export const DEMO_USER: Address = "0x00000000000000000000000000000000000A11cE";
const WAD = 10n ** 18n;
const WINDOW = 50; // generous exclusivity window for scripted rounds
const BOND = parseEther("0.01");
const ARB_BPS = 100; // 1%
// Larger than any naive-race span so, after a harvest, the job stays not-due until the
// next refill — giving clean losers even across Monad's multi-block inclusion.
const CRON_INTERVAL = 3600n;

export interface LaneWorld {
  id: LaneId;
  label: string;
  subject: Hex;
  taskId: Hex;
  naiveTarget: Address;
  coordTarget: Address;
  executors: Address[]; // one per bot
}

export interface World {
  chainId: number;
  coordinator: Address;
  bots: Address[];
  lanes: Record<LaneId, LaneWorld>;
}

export interface Arena {
  cfg: ArenaConfig;
  world: World;
  deployer: BotClients;
  botClients: BotClients[];
}

function worldPath(chainId: number): string {
  return join(DEPLOY_DIR, `arena-${chainId}.json`);
}

async function hasCode(clients: BotClients, address: Address): Promise<boolean> {
  const code = await clients.publicClient.getCode({ address });
  return !!code && code !== "0x";
}

/** Fund each bot up to the configured level from the deployer (non-anvil only). */
async function fundBots(cfg: ArenaConfig, deployer: BotClients, bots: BotClients[]): Promise<void> {
  if (cfg.chainId === 31337) return; // anvil bots are pre-funded
  for (const bot of bots) {
    const bal = await deployer.publicClient.getBalance({ address: bot.account.address });
    if (bal >= cfg.botFundingWei / 2n) continue;
    const topUp = cfg.botFundingWei - bal;
    const hash = await deployer.walletClient.sendTransaction({
      account: deployer.account,
      chain: cfg.chain,
      to: bot.account.address,
      value: topUp,
    } as never);
    await deployer.publicClient.waitForTransactionReceipt({ hash });
    console.log(`  funded ${bot.account.address} +${formatEther(topUp)} MON`);
  }
}

async function registerTask(
  deployer: BotClients,
  coordinator: Address,
  predicate: Address,
  checkParam: Hex,
  bounty: bigint,
): Promise<Hex> {
  await send(deployer, coordinator, coordinatorAbi as never, "registerTask", [
    predicate,
    checkParam,
    WINDOW,
    BOND,
    bounty,
  ], bounty > 0n ? { value: parseEther("1") } : {});
  return read<Hex>(deployer.publicClient, coordinator, coordinatorAbi as never, "computeTaskId", [
    predicate,
    checkParam,
    WINDOW,
    BOND,
    bounty,
    deployer.account.address,
  ]);
}

/** Deploy the full arena world, or load a persisted one if still on-chain. */
export async function bootstrap(cfg: ArenaConfig, forceRedeploy = false): Promise<Arena> {
  const { deployer: deployerAccount, bots: botAccounts } = accountsFor(cfg);
  const deployer = makeClients(cfg, deployerAccount);
  const botClients = botAccounts.map((a) => makeClients(cfg, a));

  await fundBots(cfg, deployer, botClients);

  const path = worldPath(cfg.chainId);
  if (!forceRedeploy && existsSync(path)) {
    const saved = JSON.parse(readFileSync(path, "utf8")) as World;
    if (await hasCode(deployer, saved.coordinator)) {
      console.log(`Reusing arena world from ${path}`);
      return { cfg, world: saved, deployer, botClients };
    }
  }

  console.log("Deploying arena world…");
  const coordinator = await deployContract(deployer, "Coordinator", []);

  // Shared predicates.
  const aavePred = await deployContract(deployer, "AaveHealthPredicate", []);
  const arbPred = await deployContract(deployer, "PriceDivergencePredicate", []);
  const cronPred = await deployContract(deployer, "IntervalPredicate", []);

  const bots = botClients.map((b) => b.account.address);

  // ── Liquidation lane ──────────────────────────────────────────────────────────
  const liqOracle = await deployContract(deployer, "MockOracle", [1_000n * WAD]);
  const naiveLiq = await deployContract(deployer, "EnforcedMockPool", [coordinator, liqOracle]);
  const coordLiq = await deployContract(deployer, "EnforcedMockPool", [coordinator, liqOracle]);
  const liqCheckParam = subjectFromAddress(coordLiq);
  const liqTask = await registerTask(deployer, coordinator, aavePred, liqCheckParam, 0n);
  await send(deployer, coordLiq, enforcedMockPoolAbi as never, "setTaskId", [liqTask]);
  const liqExecutors: Address[] = [];
  for (const bot of bots) {
    liqExecutors.push(await deployContract(deployer, "AaveLiquidationExecutor", [coordinator, bot, coordLiq]));
  }

  // ── Arb lane ────────────────────────────────────────────────────────────────
  const refOracle = await deployContract(deployer, "MockOracle", [1_000n * WAD]);
  const naiveArb = await deployContract(deployer, "MockArbPool", [coordinator, refOracle, ARB_BPS]);
  const coordArb = await deployContract(deployer, "MockArbPool", [coordinator, refOracle, ARB_BPS]);
  const arbCheckParam = packPriceParam(ARB_BPS, refOracle);
  const arbTask = await registerTask(deployer, coordinator, arbPred, arbCheckParam, 0n);
  await send(deployer, coordArb, mockArbPoolAbi as never, "setTaskId", [arbTask]);
  const arbExecutors: Address[] = [];
  for (const bot of bots) {
    arbExecutors.push(await deployContract(deployer, "ArbJobExecutor", [coordinator, bot]));
  }

  // ── Cron lane ─────────────────────────────────────────────────────────────────
  const naiveCron = await deployContract(deployer, "MockCronJob", [coordinator, CRON_INTERVAL]);
  const coordCron = await deployContract(deployer, "MockCronJob", [coordinator, CRON_INTERVAL]);
  const cronCheckParam = uintToBytes32(CRON_INTERVAL);
  const cronTask = await registerTask(deployer, coordinator, cronPred, cronCheckParam, 0n);
  await send(deployer, coordCron, mockCronJobAbi as never, "setTaskId", [cronTask]);
  const cronExecutors: Address[] = [];
  for (const bot of bots) {
    cronExecutors.push(await deployContract(deployer, "HarvestExecutor", [coordinator, bot]));
  }

  const world: World = {
    chainId: cfg.chainId,
    coordinator,
    bots,
    lanes: {
      liquidation: {
        id: "liquidation",
        label: "Aave liquidation",
        subject: subjectFromAddress(DEMO_USER),
        taskId: liqTask,
        naiveTarget: naiveLiq,
        coordTarget: coordLiq,
        executors: liqExecutors,
      },
      arb: {
        id: "arb",
        label: "DEX arbitrage",
        subject: subjectFromAddress(coordArb),
        taskId: arbTask,
        naiveTarget: naiveArb,
        coordTarget: coordArb,
        executors: arbExecutors,
      },
      cron: {
        id: "cron",
        label: "Cron / harvest",
        subject: subjectFromAddress(coordCron),
        taskId: cronTask,
        naiveTarget: naiveCron,
        coordTarget: coordCron,
        executors: cronExecutors,
      },
    },
  };

  mkdirSync(DEPLOY_DIR, { recursive: true });
  writeFileSync(path, JSON.stringify(world, null, 2));
  console.log(`Arena world written to ${path}`);
  return { cfg, world, deployer, botClients };
}
