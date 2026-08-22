import type { RoundRecord } from "@/lib/types";
import { mon } from "@/lib/format";
import { TxRow } from "./TxRow";

export function LaneColumns({ round, running }: { round: RoundRecord | undefined; running: boolean }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Column
        title="Without Reservoir"
        subtitle="every bot fires the full-price execution"
        tone="naive"
        round={round}
        side="naive"
        running={running}
      />
      <Column
        title="With Reservoir"
        subtitle="every bot fires a cheap claim; one executes"
        tone="coord"
        round={round}
        side="coordinated"
        running={running}
      />
    </div>
  );
}

function Column({
  title,
  subtitle,
  tone,
  round,
  side,
  running,
}: {
  title: string;
  subtitle: string;
  tone: "naive" | "coord";
  round: RoundRecord | undefined;
  side: "naive" | "coordinated";
  running: boolean;
}) {
  const result = round ? round[side] : undefined;
  const accent = tone === "naive" ? "text-naive" : "text-coord";
  const dot = tone === "naive" ? "bg-naive" : "bg-coord";
  const declared = result ? mon(result.declaredWei, 4) : "—";

  return (
    <div className="card flex flex-col overflow-hidden">
      <div className="flex items-start justify-between gap-2 border-b border-hairline px-4 py-3.5">
        <div>
          <div className="flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${dot}`} />
            <h3 className={`text-[14px] font-semibold tracking-tight ${accent}`}>{title}</h3>
          </div>
          <p className="mt-1 text-[12px] leading-snug text-muted">{subtitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <div className="tnum font-mono text-[13px] font-semibold text-ink">{declared}</div>
          <div className="eyebrow mt-0.5">MON billed</div>
        </div>
      </div>

      <div className="min-h-[220px] flex-1">
        {result ? (
          result.txs.map((tx, i) => <TxRow key={tx.hash} tx={tx} index={i} />)
        ) : (
          <Empty running={running} />
        )}
      </div>
    </div>
  );
}

function Empty({ running }: { running: boolean }) {
  return (
    <div className="grid h-[220px] place-items-center px-6 text-center">
      <p className="font-mono text-[12px] text-faint">
        {running ? "bots racing…" : "fire a round to watch the bots race"}
      </p>
    </div>
  );
}
