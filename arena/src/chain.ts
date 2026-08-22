import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type Address,
  type Hex,
  type PublicClient,
  type WalletClient,
} from "viem";
import type { Account } from "viem/accounts";
import { loadArtifact } from "@reservoir/keeper/artifacts";
import type { ArenaConfig } from "./config.js";

export interface BotClients {
  chain: ArenaConfig["chain"];
  account: Account;
  publicClient: PublicClient;
  walletClient: WalletClient;
}

export function makeClients(cfg: ArenaConfig, account: Account): BotClients {
  const transport = http(cfg.rpc);
  return {
    chain: cfg.chain,
    account,
    publicClient: createPublicClient({ chain: cfg.chain, transport }),
    walletClient: createWalletClient({ account, chain: cfg.chain, transport }),
  };
}

/** Deploy a compiled contract by artifact name; returns its address. */
export async function deployContract(
  clients: BotClients,
  name: string,
  args: readonly unknown[],
): Promise<Address> {
  const { abi, bytecode } = loadArtifact(name);
  const hash = await clients.walletClient.deployContract({
    abi,
    bytecode,
    args,
    account: clients.account,
    chain: clients.chain,
  } as never);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error(`deploy failed: ${name}`);
  return receipt.contractAddress;
}

/** Send a state-changing call, wait for the receipt, return gasUsed × effectiveGasPrice. */
export async function send(
  clients: BotClients,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[],
  opts: { value?: bigint; gas?: bigint } = {},
): Promise<{ hash: Hex; gasUsed: bigint; gasPrice: bigint; success: boolean; billedWei: bigint }> {
  const hash = await clients.walletClient.writeContract({
    address,
    abi,
    functionName,
    args,
    account: clients.account,
    chain: clients.chain,
    ...(opts.value !== undefined ? { value: opts.value } : {}),
    ...(opts.gas !== undefined ? { gas: opts.gas } : {}),
  } as never);
  const receipt = await clients.publicClient.waitForTransactionReceipt({ hash });
  const gasUsed = receipt.gasUsed;
  const gasPrice = receipt.effectiveGasPrice;
  return { hash, gasUsed, gasPrice, success: receipt.status === "success", billedWei: gasUsed * gasPrice };
}

/** Read a view function. */
export function read<T>(
  publicClient: PublicClient,
  address: Address,
  abi: Abi,
  functionName: string,
  args: readonly unknown[] = [],
): Promise<T> {
  return publicClient.readContract({ address, abi, functionName, args }) as Promise<T>;
}
