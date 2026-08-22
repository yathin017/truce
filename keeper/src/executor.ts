import type { Address, Hex, TransactionReceipt } from "viem";
import { baseExecutorAbi } from "@reservoir/shared/abis";
import type { Clients } from "./clients.js";
import { loadArtifact } from "./artifacts.js";

export type ExecutorKind = "aave" | "arb" | "harvest";

const ARTIFACT: Record<ExecutorKind, string> = {
  aave: "AaveLiquidationExecutor",
  arb: "DexArbExecutor",
  harvest: "HarvestExecutor",
};

/** Deploy a fresh executor owned by `operator`. Used by the race demo. */
export async function deployExecutor(
  clients: Clients,
  kind: ExecutorKind,
  coordinator: Address,
  operator: Address,
  extra: Address[] = [],
): Promise<Address> {
  const { abi, bytecode } = loadArtifact(ARTIFACT[kind]);
  const args = kind === "aave" ? [coordinator, operator, extra[0]] : [coordinator, operator];
  const hash = await clients.walletClient.deployContract({
    abi,
    bytecode,
    args,
  } as never);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`executor deploy failed (${kind})`);
  return receipt.contractAddress;
}

export interface SentTx {
  hash: Hex;
  /** Declared gas limit — what Monad bills, independent of gas used. */
  gasLimit: bigint;
  receipt: TransactionReceipt;
}

/** Race the cheap bonded claim via the executor, with a tight declared gas limit. */
export async function reserve(
  clients: Clients,
  executor: Address,
  taskId: Hex,
  subject: Hex,
  bondWei: bigint,
  gasLimit: bigint,
): Promise<SentTx> {
  const hash = await clients.walletClient.writeContract({
    address: executor,
    abi: baseExecutorAbi,
    functionName: "reserve",
    args: [taskId, subject],
    value: bondWei,
    gas: gasLimit,
  });
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  return { hash, gasLimit, receipt };
}

/** Execute the expensive work after winning the claim. */
export async function perform(
  clients: Clients,
  executor: Address,
  taskId: Hex,
  subject: Hex,
  payload: Hex,
  gasLimit: bigint,
): Promise<SentTx> {
  const hash = await clients.walletClient.writeContract({
    address: executor,
    abi: baseExecutorAbi,
    functionName: "perform",
    args: [taskId, subject, payload],
    gas: gasLimit,
  });
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  return { hash, gasLimit, receipt };
}
