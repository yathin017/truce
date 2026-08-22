"use client";

import * as React from "react";
import { sleep } from "@/lib/utils";
import { CHAINS, MONAD_TESTNET, type ChainInfo } from "@/lib/chain";
import { CONNECTED_OPERATOR } from "@/services/truce";

export type TruceNetwork = string;

export const NETWORKS: { id: TruceNetwork; label: string; chainId: number }[] = CHAINS.map(
  (c) => ({ id: c.key, label: c.name, chainId: c.id }),
);

interface WalletContextValue {
  address: string | null;
  balanceMon: number;
  connected: boolean;
  connecting: boolean;
  network: TruceNetwork;
  chain: ChainInfo;
  setNetwork: (n: TruceNetwork) => void;
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = React.createContext<WalletContextValue | null>(null);

const BALANCE_MON = 42.187;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = React.useState<string | null>(null);
  const [connecting, setConnecting] = React.useState(false);
  const [network, setNetwork] = React.useState<TruceNetwork>(MONAD_TESTNET.key);

  const connect = React.useCallback(async () => {
    setConnecting(true);
    await sleep(700);
    setAddress(CONNECTED_OPERATOR);
    setConnecting(false);
  }, []);

  const disconnect = React.useCallback(() => setAddress(null), []);

  // The console starts connected so the walkthrough never opens on an
  // empty screen.
  React.useEffect(() => {
    setAddress(CONNECTED_OPERATOR);
  }, []);

  const value = React.useMemo<WalletContextValue>(
    () => ({
      address,
      balanceMon: BALANCE_MON,
      connected: Boolean(address),
      connecting,
      network,
      chain: CHAINS.find((c) => c.key === network) ?? MONAD_TESTNET,
      setNetwork,
      connect,
      disconnect,
    }),
    [address, connecting, network, connect, disconnect],
  );

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>;
}

export function useWallet() {
  const ctx = React.useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used inside WalletProvider");
  return ctx;
}
