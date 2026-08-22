import { writeFileSync } from "node:fs";
import "dotenv/config";
import { deployFixtures } from "./fixtures.js";
import { runNaive, runCoordinated } from "./rounds.js";
import { buildReport, printReport } from "./report.js";

function getFlag(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * The centerpiece experiment: deploy a fresh world, run the naive keeper race and the
 * coordinated race back to back, and report the difference. Reproducible on local anvil.
 */
async function main(): Promise<void> {
  const rpc = getFlag("--rpc") ?? "http://127.0.0.1:8545";
  const out = getFlag("--out");

  console.log("Deploying fixtures (coordinator + voluntary pool + enforced pool)…");
  const fx = await deployFixtures(rpc);
  console.log(`  coordinator ${fx.coordinator}`);
  console.log(`  naive pool  ${fx.naivePool}  (voluntary)`);
  console.log(`  coord pool  ${fx.coordPool}  (enforced, task ${fx.taskId.slice(0, 10)}…)`);

  console.log("\nRound A — naive race (four 500k liquidations, one lands)…");
  const naive = await runNaive(fx);
  console.log(`  winner: keeper K${naive.winner + 1}; ${naive.txs.length} txs`);

  console.log("\nRound B — coordinated race (four cheap claims, one executes)…");
  const coordinated = await runCoordinated(fx);
  console.log(`  winner: keeper K${coordinated.winner + 1}; ${coordinated.txs.length} txs`);

  const report = buildReport(naive, coordinated);
  printReport(report);

  if (out) {
    writeFileSync(out, JSON.stringify(report, null, 2));
    console.log(`Report written to ${out}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
