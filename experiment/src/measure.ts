import { createPublicClient, createWalletClient, http, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  formatMon,
  declaredExposureWei,
  reductionPct,
  claimGasLimit,
  PERFORM_GAS_LIMIT,
  type TxGas,
} from "@reservoir/shared";
import { coordinatorAbi } from "@reservoir/shared/abis";
import { deployExecutor, reserve, perform } from "@reservoir/keeper/executor";
import { deployFixtures, resolveKeys, chainFor } from "./fixtures.js";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  const CLAIM_GAS = claimGasLimit(chainId);
  const PERFORM_GAS = PERFORM_GAS_LIMIT;

  const executor = await deployExecutor(clients, "aave", fx.coordinator, account.address, [fx.coordPool]);

  // Monad executes blocks asynchronously, so a just-mined state change may not yet be
  // reflected. Confirm the subject actually reads eligible before racing the claim.
  const isEligible = () =>
    clients.publicClient.readContract({
      address: fx.coordinator,
      abi: coordinatorAbi,
      functionName: "isEligible",
      args: [fx.taskId, fx.subject],
    }) as Promise<boolean>;
  for (let i = 0; i < 20 && !(await isEligible()); i++) await sleep(500);
  if (!(await isEligible())) throw new Error("subject never became eligible");

  const claimTx = await reserve(clients, executor, fx.taskId, fx.subject, fx.bondWei, CLAIM_GAS);
  if (claimTx.receipt.status !== "success") {
    throw new Error(
      `measurement claim reverted (gasUsed ${claimTx.receipt.gasUsed} / declared ${CLAIM_GAS}; ` +
        `on Monad a revert is charged the full declared limit — inspect with 'cast run ${claimTx.hash}')`,
    );
  }
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
