import { parseEther, getAddress, type Address } from "viem";
import "dotenv/config";
import { loadConfig } from "./config.js";
import { makeClients } from "./clients.js";
import { Keeper } from "./keeper.js";
import { CoordinatorReader, subjectOf } from "./coordinator.js";
import { Logger } from "./log.js";
import { runRace } from "./race.js";

function usage(): never {
  console.log(`reservoir-keeper — a gas-aware keeper daemon for Monad

Usage:
  reservoir-keeper run       --config <path>   run the daemon (claims + executes)
  reservoir-keeper simulate  --config <path>   read-only: poll eligibility + holders
  reservoir-keeper race      [--rpc <url>] [--chain <id>]   demo: 4 bots race one job

Flags:
  --config <path>   keeper YAML config (run/simulate)
  --dry-run         never send txs; log intended actions (run)
  --rpc <url>       RPC url for race (default http://127.0.0.1:8545)
  --chain <id>      chainId for race (default 31337)
`);
  process.exit(1);
}

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function hasFlag(name: string): boolean {
  return process.argv.includes(name);
}

async function cmdRun(dry: boolean): Promise<void> {
  const configPath = getFlag("--config");
  if (!configPath) usage();
  const cfg = loadConfig(configPath);
  if (dry) cfg.safety.dryRun = true;
  if (!cfg.coordinator) throw new Error("coordinator address unknown (set config.coordinator or deploy first)");
  if (!cfg.executor) throw new Error("run mode requires config.executor");

  const clients = makeClients(cfg);
  const known = new Set(cfg.tasks.map((t) => t.taskId.toLowerCase()));
  const bondWei = parseEther(cfg.safety.maxBondPerClaim); // upper bound; real bond read per task
  const log = new Logger(cfg.label ?? clients.account.address.slice(0, 8));
  const keeper = new Keeper(cfg, clients, known, log, cfg.coordinator, cfg.executor, bondWei);

  process.on("SIGINT", () => {
    keeper.stop();
    console.log("\n" + keeper.gas.summary());
    process.exit(0);
  });
  await keeper.run();
}

async function cmdSimulate(): Promise<void> {
  const configPath = getFlag("--config");
  if (!configPath) usage();
  const cfg = loadConfig(configPath);
  if (!cfg.coordinator) throw new Error("coordinator address unknown");
  const clients = makeClients(cfg);
  const reader = new CoordinatorReader(clients, cfg.coordinator);
  const log = new Logger("simulate");

  for (const task of cfg.tasks) {
    const subjects = task.subjects === "auto" ? [] : task.subjects;
    for (const addr of subjects) {
      const subject = subjectOf(getAddress(addr as Address));
      const eligible = await reader.isEligible(task.taskId, subject);
      const holder = await reader.holder(task.taskId, subject);
      const stats = await reader.taskStats(task.taskId);
      log.info(
        `${task.taskId.slice(0, 10)}…/${addr} eligible=${eligible} holder=${holder.slice(0, 10)}… ` +
          `slashRate=${(reader.slashRate(stats) * 100).toFixed(1)}%`,
      );
    }
  }
}

async function main(): Promise<void> {
  const cmd = process.argv[2];
  switch (cmd) {
    case "run":
      return cmdRun(hasFlag("--dry-run"));
    case "simulate":
      return cmdSimulate();
    case "race":
      return runRace({
        rpc: getFlag("--rpc") ?? "http://127.0.0.1:8545",
        chainId: Number(getFlag("--chain") ?? 31337),
      });
    default:
      usage();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
