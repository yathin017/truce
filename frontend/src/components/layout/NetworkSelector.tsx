"use client";

import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { NETWORKS, useWallet, type TruceNetwork } from "@/providers/WalletProvider";
import { StatusDot } from "@/components/StatusBadge";

export function NetworkSelector() {
  const { network, setNetwork } = useWallet();

  return (
    <Select value={network} onValueChange={(v) => setNetwork(v as TruceNetwork)}>
      <SelectTrigger className="h-9 w-[168px] bg-panel text-[13px]">
        <span className="flex items-center gap-2">
          <StatusDot tone={network === "anvil" ? "accent" : "ok"} />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {NETWORKS.map((n) => (
          <SelectItem key={n.id} value={n.id}>
            {n.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
