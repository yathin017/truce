import "dotenv/config";
import { formatEther } from "viem";
import { loadConfig } from "./config.js";
import { bootstrap } from "./world.js";
import { Engine } from "./engine.js";
import { startServer } from "./server.js";

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  const chainId = Number(getFlag("--chain") ?? 31337);
  const cmd = process.argv[2] ?? "serve";
  const forceRedeploy = process.argv.includes("--redeploy");

  const cfg = loadConfig(chainId);
  console.log(`Reservoir arena — chain ${chainId} (${cfg.rpc})`);
  console.log(`  budget cap ${formatEther(cfg.budgetCapWei)} MON · auto interval ${cfg.autoIntervalMs}ms`);

  const arena = await bootstrap(cfg, forceRedeploy);
  console.log(`  coordinator ${arena.world.coordinator}`);
  for (const lane of Object.values(arena.world.lanes)) {
    console.log(`  ${lane.id.padEnd(12)} naive ${lane.naiveTarget} · coord ${lane.coordTarget}`);
  }

  const engine = new Engine(arena);
  await engine.init();

  if (cmd === "round") {
    // One-shot: run each lane once, print, exit.
    await engine.runAll();
    const s = engine.state();
    console.log("\n── result ──");
    for (const l of s.lanes) {
      console.log(`  ${l.label.padEnd(18)} mean savings ${l.meanSavingsPct.toFixed(1)}% (${l.rounds} round)`);
    }
    console.log(`  overall mean savings ${s.overall.meanSavingsPct.toFixed(1)}%`);
    console.log(`  spent ${formatEther(BigInt(s.budget.spentWei))} MON`);
    return;
  }

  const auto = process.argv.includes("--auto");
  await startServer(engine, cfg.port);
  if (auto) {
    console.log("\nauto-loop starting…");
    engine.startAuto();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
