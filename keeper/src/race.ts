import { createPublicClient, createWalletClient, http, pad, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  requireDeployment,
  formatMon,
  declaredExposureWei,
  blockGasReserved,
  usefulWorkRatio,
  reductionPct,
  claimGasLimit,
  PERFORM_GAS_LIMIT,
  type TxGas,
} from "@reservoir/shared";
import { coordinatorAbi } from "@reservoir/shared/abis";
import { chainFor } from "./clients.js";
import { deployExecutor, reserve, perform } from "./executor.js";
import { Logger } from "./log.js";

/** Well-known anvil keys: account 0 deploys/seeds, accounts 1-4 are the racing keepers. */
const ANVIL_KEYS = {
  deployer: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  keepers: [
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
    "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
    "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
    "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  ],
} as const;

const DEMO_USER: Address = "0x00000000000000000000000000000000000A11cE";
const PERFORM_GAS = PERFORM_GAS_LIMIT; // a real liquidation's success-path limit

export interface RaceOptions {
  rpc: string;
  chainId: number;
}

/**
 * The A4 gate: four keeper bots race one liquidation.
 *
 * Round A (naive): every bot would fire the ~500k liquidation; only one lands, three
 * revert — but on Monad each declared its full 500k limit and pays for it.
 * Round B (coordinated): every bot fires the cheap ~150k claim; one wins and executes,
 * three stand down after paying only their tight claim limit.
 */
export async function runRace(opts: RaceOptions): Promise<void> {
  const chain = chainFor(opts.chainId);
  const transport = http(opts.rpc);
  const dep = requireDeployment(opts.chainId);
  const coordinator = dep.coordinator;
  const pool = dep.mockPool!;
  const taskId = dep.tasks.aave!.taskId;
  const subject = pad(DEMO_USER, { size: 32 });

  const deployer = privateKeyToAccount(ANVIL_KEYS.deployer);
  const deployerWallet = createWalletClient({ account: deployer, chain, transport });
  const publicClient = createPublicClient({ chain, transport });
  const claimGas = claimGasLimit(opts.chainId);

  const bondWei = (
    (await publicClient.readContract({
      address: coordinator,
      abi: coordinatorAbi,
      functionName: "getTask",
      args: [taskId],
    })) as { bondWei: bigint }
  ).bondWei;

  const log = new Logger("race");
  log.info(`coordinator ${coordinator} · task ${taskId.slice(0, 10)}… · bond ${formatMon(bondWei)}`);

  // Reset the demo position to healthy, then deploy one executor per keeper.
  await writePool(deployerWallet, publicClient, pool, "setCollateralPrice", [1_000n * 10n ** 18n]);
  await writePool(deployerWallet, publicClient, pool, "createPosition", [
    DEMO_USER,
    10n * 10n ** 18n,
    7_500n * 10n ** 18n,
  ]);

  const keepers = ANVIL_KEYS.keepers.map((pk, i) => {
    const account = privateKeyToAccount(pk);
    const wallet = createWalletClient({ account, chain, transport });
    return { i, account, clients: { chain, account, publicClient, walletClient: wallet } };
  });

  const executors: Address[] = [];
  for (const k of keepers) {
    executors.push(await deployExecutor(k.clients, "aave", coordinator, k.account.address, [pool]));
  }
  log.info(`deployed ${executors.length} keeper executors`);

  // DROP PRICE → position becomes liquidatable.
  await writePool(deployerWallet, publicClient, pool, "setCollateralPrice", [800n * 10n ** 18n]);
  log.warn("DROP PRICE → position is now liquidatable (HF < 1)");

  // ── Round B: coordinated — four cheap claims fired together ──────────────────
  const claimTxs: TxGas[] = [];
  const results = await Promise.allSettled(
    keepers.map((k) =>
      reserve(k.clients, executors[k.i]!, taskId, subject, bondWei, claimGas).then((tx) => ({ k, tx })),
    ),
  );

  let winnerIdx = -1;
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { k, tx } = r.value;
    const ok = tx.receipt.status === "success";
    claimTxs.push({ gasLimit: tx.gasLimit, gasUsed: tx.receipt.gasUsed, gasPrice: tx.receipt.effectiveGasPrice });
    if (ok) {
      winnerIdx = k.i;
      log.win(`K${k.i + 1} won the claim (gas used ${tx.receipt.gasUsed}, declared ${tx.gasLimit})`);
    } else {
      log.standDown(`K${k.i + 1} lost — stood down (declared ${tx.gasLimit}, billed on Monad regardless)`);
    }
  }
  if (winnerIdx < 0) throw new Error("no keeper won the claim");

  const winner = keepers[winnerIdx]!;
  const performTx = await perform(winner.clients, executors[winnerIdx]!, taskId, subject, "0x", PERFORM_GAS);
  log.win(`K${winnerIdx + 1} executed the liquidation (gas used ${performTx.receipt.gasUsed})`);
  const performGas: TxGas = {
    gasLimit: performTx.gasLimit,
    gasUsed: performTx.receipt.gasUsed,
    gasPrice: performTx.receipt.effectiveGasPrice,
  };

  report(log, claimTxs, performGas);
}

/** Reconstruct the naive-race counterfactual: all four bots declare the 500k limit. */
function report(log: Logger, claimTxs: TxGas[], performGas: TxGas): void {
  const price = performGas.gasPrice;
  const n = claimTxs.length;

  const naive: TxGas[] = Array.from({ length: n }, (_, i) => ({
    gasLimit: PERFORM_GAS,
    // one succeeds, the rest revert at the health check having done a little work
    gasUsed: i === 0 ? performGas.gasUsed : 40_000n,
    gasPrice: price,
  }));
  const coordinated: TxGas[] = [...claimTxs, performGas];

  const naiveDeclared = declaredExposureWei(naive);
  const coordDeclared = declaredExposureWei(coordinated);

  console.log("");
  console.log("  ── DECLARED-LIMIT EXPOSURE (what Monad bills) ─────────────────");
  console.log(`  Naive race    ${formatMon(naiveDeclared)}  (${blockGasReserved(naive)} gas reserved)`);
  console.log(`  Coordinated   ${formatMon(coordDeclared)}  (${blockGasReserved(coordinated)} gas reserved)`);
  console.log(`  Reduction     ${reductionPct(naiveDeclared, coordDeclared).toFixed(1)}%`);
  console.log("");
  console.log("  ── USEFUL-WORK RATIO (gas used / gas reserved) ────────────────");
  console.log(`  Naive race    ${(usefulWorkRatio(naive) * 100).toFixed(1)}%`);
  console.log(`  Coordinated   ${(usefulWorkRatio(coordinated) * 100).toFixed(1)}%`);
  console.log("");
  log.win(`losers paid the tight claim limit, not the 500k execution limit — that is the product`);
}

const POOL_ABI = [
  { type: "function", name: "setCollateralPrice", inputs: [{ type: "uint256" }], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "createPosition",
    inputs: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

async function writePool(
  wallet: ReturnType<typeof createWalletClient>,
  publicClient: ReturnType<typeof createPublicClient>,
  pool: Address,
  fn: "setCollateralPrice" | "createPosition",
  args: readonly unknown[],
): Promise<void> {
  const hash = await wallet.writeContract({
    address: pool,
    abi: POOL_ABI,
    functionName: fn,
    args: args as never,
    account: wallet.account!,
    chain: wallet.chain,
  });
  await publicClient.waitForTransactionReceipt({ hash });
}
