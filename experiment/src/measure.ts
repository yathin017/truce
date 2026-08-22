import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { formatMon, declaredExposureWei, reductionPct, type TxGas } from "@reservoir/shared";
import { deployExecutor, reserve, perform } from "@reservoir/keeper/executor";
import { deployFixtures, resolveKeys, chainFor } from "./fixtures.js";

const CLAIM_GAS = 130_000n;
const PERFORM_GAS = 500_000n;

export interface Measurement {
  chainId: number;
  claimGasUsed: string;
  claimGasDeclared: string;
  liquidationGasUsed: string;
  liquidationGasDeclared: string;
  gasPriceWei: string;
  modeledNaiveDeclaredWei: string; // 4 × 500k
  modeledCoordinatedDeclaredWei: string; // 4 × claimDeclared + 500k
  modeledDeclaredReductionPct: number;
}

/**
 * Single-key gas probe — measures real success-path gas for a claim and a liquidation on
 * the target chain (only the deployer account needs funds), then models the four-keeper
 * declared-limit exposure from those numbers. Ideal for capturing Monad testnet figures.
 */
export async function runMeasure(rpc: string, chainId: number): Promise<Measurement> {
  const fx = await deployFixtures(rpc, chainId);
  const { deployer } = resolveKeys(chainId);
  const account = privateKeyToAccount(deployer);
  const chain = chainFor(chainId);
  const transport = http(rpc);
  const clients = {
    chain,
    account,
    publicClient: createPublicClient({ chain, transport }),
    walletClient: createWalletClient({ account, chain, transport }),
  };

  const executor = await deployExecutor(clients, "aave", fx.coordinator, account.address, [fx.coordPool]);
  const claimTx = await reserve(clients, executor, fx.taskId, fx.subject, fx.bondWei, CLAIM_GAS);
  if (claimTx.receipt.status !== "success") throw new Error("measurement claim reverted");
  const performTx = await perform(clients, executor, fx.taskId, fx.subject, "0x", PERFORM_GAS);
  if (performTx.receipt.status !== "success") throw new Error("measurement liquidation reverted");

  const price = performTx.receipt.effectiveGasPrice;

  const naive: TxGas[] = Array.from({ length: 4 }, () => ({ gasLimit: PERFORM_GAS, gasUsed: 0n, gasPrice: price }));
  const coordinated: TxGas[] = [
    ...Array.from({ length: 4 }, () => ({ gasLimit: CLAIM_GAS, gasUsed: 0n, gasPrice: price })),
    { gasLimit: PERFORM_GAS, gasUsed: 0n, gasPrice: price },
  ];
  const naiveDeclared = declaredExposureWei(naive);
  const coordDeclared = declaredExposureWei(coordinated);

  const m: Measurement = {
    chainId,
    claimGasUsed: claimTx.receipt.gasUsed.toString(),
    claimGasDeclared: CLAIM_GAS.toString(),
    liquidationGasUsed: performTx.receipt.gasUsed.toString(),
    liquidationGasDeclared: PERFORM_GAS.toString(),
    gasPriceWei: price.toString(),
    modeledNaiveDeclaredWei: naiveDeclared.toString(),
    modeledCoordinatedDeclaredWei: coordDeclared.toString(),
    modeledDeclaredReductionPct: reductionPct(naiveDeclared, coordDeclared),
  };

  console.log("\n══ Reservoir gas measurement ═════════════════════════════════════\n");
  console.log(`chain            ${chainId}`);
  console.log(`gas price        ${formatMon(price)} / gas`);
  console.log(`claim            used ${m.claimGasUsed} (declared ${m.claimGasDeclared})`);
  console.log(`liquidation      used ${m.liquidationGasUsed} (declared ${m.liquidationGasDeclared})`);
  console.log("");
  console.log("Modeled 4-keeper declared-limit exposure (what Monad bills):");
  console.log(`  naive          ${formatMon(naiveDeclared)}`);
  console.log(`  coordinated    ${formatMon(coordDeclared)}`);
  console.log(`  reduction      ${m.modeledDeclaredReductionPct.toFixed(1)}%`);
  console.log("\n══════════════════════════════════════════════════════════════════\n");
  return m;
}
