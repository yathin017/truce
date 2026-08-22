"use client";

import * as React from "react";
import { Loader2, LogOut, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/providers/WalletProvider";
import { shortAddress } from "@/lib/format";

export function WalletButton() {
  const { address, connected, connecting, connect, disconnect, balanceMon } = useWallet();

  if (!connected) {
    return (
      <Button variant="primary" size="sm" onClick={connect} disabled={connecting}>
        {connecting ? <Loader2 className="animate-spin" /> : <Wallet />}
        {connecting ? "Connecting" : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-panel py-1 pl-3 pr-1">
      <span className="hidden font-mono text-[11px] text-faint sm:inline">
        {balanceMon.toLocaleString()} MON
      </span>
      <span className="hidden h-4 w-px bg-line sm:inline" />
      <span className="font-mono text-[12px] text-fg">
        {shortAddress(address ?? "")}
      </span>
      <button
        onClick={disconnect}
        title="Disconnect"
        className="rounded p-1.5 text-faint transition-colors hover:bg-elevated hover:text-bad"
      >
        <LogOut className="size-3.5" />
      </button>
    </div>
  );
}
