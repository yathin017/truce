import { declaredExposureWei, formatMon, type TxGas } from "@reservoir/shared";

// Placeholder — Run A vs Run B harness lands in PR A5.
function main() {
  const sample: TxGas[] = [{ gasLimit: 500_000n, gasUsed: 45_000n, gasPrice: 1n }];
  console.log("reservoir-experiment: scaffold. Harness implemented in A5.");
  console.log(`declared exposure (sample): ${formatMon(declaredExposureWei(sample))}`);
}

main();
