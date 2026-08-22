import type { TxRecord } from "@/lib/types";
import { gasNum, mon, shortHash, usefulRatio } from "@/lib/format";

const ROLE_LABEL: Record<TxRecord["role"], string> = {
  liquidate: "liquidate",
  arb: "arbitrage",
  harvest: "harvest",
  claim: "claim",
  execute: "execute",
};

export function TxRow({ tx, index }: { tx: TxRecord; index: number }) {
  const isNaive = tx.side === "naive";
  const roleClass = isNaive ? "text-naive" : "text-coord";
  const barClass = isNaive ? "bg-naive" : "bg-coord";
  const ratio = usefulRatio(tx);
  const wasted = !tx.success && ratio < 0.5;

  return (
    <div
      className="animate-row-in border-t border-hairline-2 px-4 py-3 first:border-t-0"
      style={{ animationDelay: `${Math.min(index, 8) * 45}ms` }}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <StatusGlyph success={tx.success} isNaive={isNaive} />
          <span className={`font-mono text-[12px] font-semibold ${roleClass}`}>{ROLE_LABEL[tx.role]}</span>
          <span className="font-mono text-[11px] text-faint">K{tx.botIndex + 1}</span>
        </div>
        <div className="shrink-0 text-right">
          <span className="tnum font-mono text-[12.5px] font-semibold text-ink">{mon(tx.gasBilledWei, 4)}</span>
          <span className="ml-1 font-mono text-[10px] uppercase tracking-wide text-faint">MON billed</span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-3">
        <div className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-hairline">
          <div
            className={`h-full origin-left animate-fill rounded-full ${barClass}`}
            style={{ width: `${Math.max(4, ratio * 100)}%` }}
          />
        </div>
        <span className="tnum whitespace-nowrap font-mono text-[10.5px] text-muted">
          {gasNum(tx.gasUsed)} / {gasNum(tx.gasLimit)} gas
        </span>
        <div className="ml-auto">
          {tx.explorerUrl ? (
            <a
              href={tx.explorerUrl}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-[10.5px] text-muted underline decoration-hairline underline-offset-2 hover:text-ink hover:decoration-ink"
            >
              {shortHash(tx.hash)} ↗
            </a>
          ) : (
            <span className="font-mono text-[10.5px] text-faint">{shortHash(tx.hash)}</span>
          )}
        </div>
      </div>

      {wasted && (
        <p className="mt-1.5 font-mono text-[10.5px] text-naive">
          reverted having used {Math.round(ratio * 100)}% of its limit — billed in full
        </p>
      )}
    </div>
  );
}

function StatusGlyph({ success, isNaive }: { success: boolean; isNaive: boolean }) {
  if (success) {
    const cls = isNaive ? "bg-naive-tint text-naive" : "bg-coord-tint text-coord";
    return (
      <span className={`grid h-4 w-4 place-items-center rounded-full ${cls}`}>
        <svg width="9" height="9" viewBox="0 0 10 10" aria-hidden>
          <path
            d="M1.5 5.2 4 7.5 8.5 2.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    );
  }
  return (
    <span className="grid h-4 w-4 place-items-center rounded-full bg-hairline text-faint">
      <svg width="8" height="8" viewBox="0 0 10 10" aria-hidden>
        <path d="M2 2 8 8M8 2 2 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    </span>
  );
}
