import { mon } from "@/lib/format";

/** Two magnitude bars — MON billed on each side — with the savings as a direct label. */
export function GasCompare({
  naiveWei,
  coordWei,
  savingsPct,
}: {
  naiveWei: string;
  coordWei: string;
  savingsPct: number;
}) {
  const n = Number(BigInt(naiveWei || "0"));
  const c = Number(BigInt(coordWei || "0"));
  const coordW = n > 0 ? Math.max(3, (c / n) * 100) : 0;

  return (
    <div className="card p-5">
      <div className="flex items-baseline justify-between">
        <span className="eyebrow">MON billed this round</span>
        <span className="tnum font-mono text-[13px] font-semibold text-coord">
          −{savingsPct.toFixed(0)}%
        </span>
      </div>

      <div className="mt-4 space-y-3">
        <BarRow label="Without" value={mon(naiveWei, 4)} widthPct={100} tone="naive" />
        <BarRow label="With" value={mon(coordWei, 4)} widthPct={coordW} tone="coord" />
      </div>
    </div>
  );
}

function BarRow({
  label,
  value,
  widthPct,
  tone,
}: {
  label: string;
  value: string;
  widthPct: number;
  tone: "naive" | "coord";
}) {
  const fill = tone === "naive" ? "bg-naive" : "bg-coord";
  return (
    <div className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</span>
      <div className="h-6 overflow-hidden rounded-md bg-hairline-2">
        <div
          className={`h-full origin-left animate-fill rounded-md ${fill}`}
          style={{ width: `${widthPct}%` }}
        />
      </div>
      <span className="tnum w-24 text-right font-mono text-[12.5px] text-ink">{value}</span>
    </div>
  );
}
