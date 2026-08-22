"use client";

import * as React from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { MONAD_TESTNET, explorerAddress } from "@/lib/chain";

export function truncateHex(value: string, head = 6, tail = 4): string {
  if (value.length <= head + tail + 2) return value;
  return `${value.slice(0, head + 2)}…${value.slice(-tail)}`;
}

export function Hash({
  value,
  head = 6,
  tail = 4,
  copyable = true,
  href,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  copyable?: boolean;
  href?: string;
  className?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_200);
    } catch {
      /* clipboard blocked — the full value is in the title attribute */
    }
  };

  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="font-mono text-[12px] text-fg" title={value}>
        {truncateHex(value, head, tail)}
      </span>
      {copyable ? (
        <button
          onClick={copy}
          aria-label="Copy"
          className="text-faint transition-colors hover:text-fg"
        >
          {copied ? <Check className="size-3 text-ok" /> : <Copy className="size-3" />}
        </button>
      ) : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="text-faint transition-colors hover:text-accent"
        >
          <ExternalLink className="size-3" />
        </a>
      ) : null}
    </span>
  );
}

export function AddressLink({
  address,
  className,
  ...rest
}: {
  address: string;
  head?: number;
  tail?: number;
  copyable?: boolean;
  className?: string;
}) {
  return (
    <Hash
      value={address}
      href={explorerAddress(MONAD_TESTNET, address)}
      className={className}
      {...rest}
    />
  );
}
