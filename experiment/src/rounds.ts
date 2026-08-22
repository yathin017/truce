import { createPublicClient, createWalletClient, http, type Address } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { claimGasLimit, PERFORM_GAS_LIMIT, type TxGas } from "@truce/shared";
import { deployExecutor, reserve, perform } from "@truce/keeper/executor";
import { loadArtifact } from "@truce/keeper/artifacts";
import { DEMO_USER, type Fixtures } from "./fixtures.js";

const PERFORM_GAS = PERFORM_GAS_LIMIT; // real liquidation success-path limit

export interface RoundResult {
  label: string;
  txs: TxGas[];
  winner: number; // keeper index, or -1
}

function keeperClients(fx: Fixtures) {
  const transport = http(fx.rpc);
  const publicClient = createPublicClient({ chain: fx.chain, transport });
  return fx.keeperKeys.map((pk) => {
    const account = privateKeyToAccount(pk);
    const walletClient = createWalletClient({ account, chain: fx.chain, transport });
    return { chain: fx.chain, account, publicClient, walletClient };
  });
}

function toGas(receipt: { gasUsed: bigint; effectiveGasPrice: bigint }, declared: bigint): TxGas {
  return { gasLimit: declared, gasUsed: receipt.gasUsed, gasPrice: receipt.effectiveGasPrice };
}

/**
 * Round A — the world today: every keeper fires the expensive liquidation directly at the
 * (voluntary) pool, each declaring the ~500k success-path limit. One lands; the rest revert
 * "already liquidated" — but on Monad every one of them is billed its full declared limit.
 */
export async function runNaive(fx: Fixtures): Promise<RoundResult> {
  const keepers = keeperClients(fx);
  const { abi } = loadArtifact("EnforcedMockPool");
  const txs: TxGas[] = [];
  let winner = -1;

  const results = await Promise.allSettled(
    keepers.map(async (k, i) => {
      const hash = await k.walletClient.writeContract({
        address: fx.naivePool,
        abi,
        functionName: "liquidate",
        args: [DEMO_USER],
        gas: PERFORM_GAS,
        account: k.account,
        chain: k.chain,
      } as never);
      const receipt = await k.publicClient.waitForTransactionReceipt({ hash });
      return { i, receipt };
    }),
  );

  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { i, receipt } = r.value;
    txs.push(toGas(receipt, PERFORM_GAS));
    if (receipt.status === "success") winner = i;
  }
  return { label: "naive", txs, winner };
}

/**
 * Round B — coordinated: every keeper fires the cheap claim (~130k). One wins and executes
 * the 500k liquidation; the three losers paid only their tight claim limit and stood down.
 */
export async function runCoordinated(fx: Fixtures): Promise<RoundResult> {
  const keepers = keeperClients(fx);
  const claimGas = claimGasLimit(fx.chainId);
  const executors: Address[] = [];
  for (const k of keepers) {
    executors.push(await deployExecutor(k, "aave", fx.coordinator, k.account.address, [fx.coordPool]));
  }

  const txs: TxGas[] = [];
  let winner = -1;

  const results = await Promise.allSettled(
    keepers.map((k, i) =>
      reserve(k, executors[i]!, fx.taskId, fx.subject, fx.bondWei, claimGas).then((tx) => ({ i, tx })),
    ),
  );
  for (const r of results) {
    if (r.status !== "fulfilled") continue;
    const { i, tx } = r.value;
    txs.push(toGas(tx.receipt, tx.gasLimit));
    if (tx.receipt.status === "success") winner = i;
  }
  if (winner < 0) throw new Error("no keeper won the coordinated claim");

  const perf = await perform(keepers[winner]!, executors[winner]!, fx.taskId, fx.subject, "0x", PERFORM_GAS);
  txs.push(toGas(perf.receipt, perf.gasLimit));

  return { label: "coordinated", txs, winner };
}
