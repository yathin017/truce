import type { ArenaState } from "@/lib/types";
import { mon } from "@/lib/format";

/** Session-cumulative MON billed by each strategy — the running toll. */
export function BurnMeter({ state }: { state: ArenaState | null }) {
  const naive = state ? BigInt(state.overall.cumulativeNaiveWei) : 0n;
  const coord = state ? BigInt(state.overall.cumulativeCoordWei) : 0n;
  const saved = naive - coord;
  const coordW = naive > 0n ? Math.max(3, Number((coord * 1000n) / naive) / 10) : 0;

  return (
    <section className="border-t border-hairline bg-raised/60">
      <div className="wrap py-16">
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="eyebrow">Session toll</p>
            <h2 className="mt-3 text-[1.7rem] font-semibold leading-tight tracking-tight">
              Every round adds to the bill. Only one side keeps it down.
            </h2>
            <p className="mt-4 text-[14.5px] leading-relaxed text-muted">
              Total MON billed on Monad since this session started — declared-limit basis, the way
              the chain actually charges. The gap is real money keepers don&apos;t burn.
            </p>
          </div>

          <div className="card p-6">
            <Bar label="Without Truce" wei={naive} widthPct={100} tone="naive" />
            <div className="h-4" />
            <Bar label="With Truce" wei={coord} widthPct={coordW} tone="coord" />
            <div className="mt-6 flex items-baseline justify-between border-t border-hairline pt-4">
              <span className="eyebrow">Kept out of the fire</span>
              <span className="tnum font-mono text-2xl font-semibold text-coord">
                {mon(saved, 4)}
                <span className="ml-1.5 text-sm text-coord/70">MON</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Bar({
  label,
  wei,
  widthPct,
  tone,
}: {
  label: string;
  wei: bigint;
  widthPct: number;
  tone: "naive" | "coord";
}) {
  const fill = tone === "naive" ? "bg-naive" : "bg-coord";
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
        <span className="tnum font-mono text-[13px] text-ink">{mon(wei, 4)} MON</span>
      </div>
      <div className="h-7 overflow-hidden rounded-md bg-hairline-2">
        <div className={`h-full origin-left rounded-md transition-[width] duration-700 ${fill}`} style={{ width: `${widthPct}%` }} />
      </div>
    </div>
  );
}
