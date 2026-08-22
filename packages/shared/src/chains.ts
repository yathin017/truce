import { defineChain } from "viem";
import { foundry } from "viem/chains";

/**
 * Monad testnet — chainId 10143.
 * RPC:      https://testnet-rpc.monad.xyz
 * Explorer: https://testnet.monadexplorer.com
 * Faucet:   https://faucet.monad.xyz
 */
export const monadTestnet = defineChain({
  id: 10_143,
  name: "Monad Testnet",
  nativeCurrency: { name: "Monad", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

/** Local anvil devnet — chainId 31337. */
export const anvil = foundry;

export const CHAINS = { monadTestnet, anvil } as const;
export type ChainKey = keyof typeof CHAINS;

/** Resolve a chain by key with an env-overridable RPC URL. */
export function resolveChain(key: ChainKey, rpcUrl?: string) {
  const chain = CHAINS[key];
  if (!rpcUrl) return { chain, rpcUrl: chain.rpcUrls.default.http[0] };
  return { chain, rpcUrl };
}
