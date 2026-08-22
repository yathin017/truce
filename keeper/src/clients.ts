import { createPublicClient, createWalletClient, http, type Chain } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet, anvil } from "@truce/shared";
import type { KeeperConfig } from "./types.js";

export function chainFor(chainId: number): Chain {
  if (chainId === monadTestnet.id) return monadTestnet;
  return anvil;
}

export function makeClients(cfg: KeeperConfig) {
  const chain = chainFor(cfg.chainId);
  const account = privateKeyToAccount(cfg.account);
  const transport = http(cfg.rpc);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });
  return { chain, account, publicClient, walletClient };
}

export type Clients = ReturnType<typeof makeClients>;
