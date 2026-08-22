"use client";

import * as React from "react";
import { CheckCircle2, ExternalLink, Loader2, XCircle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { shortAddress } from "@/lib/format";

export type TxState = "idle" | "pending" | "success" | "error";

export function TransactionModal({
  open,
  onOpenChange,
  state,
  pendingLabel,
  successLabel,
  errorLabel,
  txHash,
  details,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TxState;
  pendingLabel: string;
  successLabel: string;
  errorLabel?: string;
  txHash?: string;
  details?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" hideClose={state === "pending"}>
        <div className="px-6 py-7">
          <div className="flex flex-col items-center text-center">
            {state === "pending" && (
              <>
                <span className="relative flex size-12 items-center justify-center rounded-full border border-accent/30 bg-accent/10">
                  <Loader2 className="size-5 animate-spin text-accent" />
                </span>
                <DialogTitle className="mt-4 text-[15px] font-semibold text-fg">
                  {pendingLabel}
                </DialogTitle>
                <p className="mt-1.5 text-[13px] text-muted">
                  Waiting for confirmation on Monad…
                </p>
              </>
            )}

            {state === "success" && (
              <>
                <span className="flex size-12 items-center justify-center rounded-full border border-ok/30 bg-ok/10">
                  <CheckCircle2 className="size-5 text-ok" />
                </span>
                <DialogTitle className="mt-4 text-[15px] font-semibold text-fg">
                  {successLabel}
                </DialogTitle>
              </>
            )}

            {state === "error" && (
              <>
                <span className="flex size-12 items-center justify-center rounded-full border border-bad/30 bg-bad/10">
                  <XCircle className="size-5 text-bad" />
                </span>
                <DialogTitle className="mt-4 text-[15px] font-semibold text-fg">
                  {errorLabel ?? "Transaction failed"}
                </DialogTitle>
              </>
            )}
          </div>

          {details ? <div className="mt-6">{details}</div> : null}

          {txHash && state !== "pending" ? (
            <div className="mt-4 flex items-center justify-between rounded-md border border-line bg-surface px-3 py-2.5">
              <span className="label-micro">Tx Hash</span>
              <span className="font-mono text-[12px] text-muted">
                {shortAddress(txHash, 10, 6)}
              </span>
            </div>
          ) : null}

          {actions ? (
            <div className="mt-6 grid gap-2.5">{actions}</div>
          ) : state === "success" ? (
            <div className="mt-6 grid gap-2.5">
              <Button variant="outline" size="md" disabled={!txHash}>
                <ExternalLink />
                View Transaction
              </Button>
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
