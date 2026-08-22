import type { ArenaState } from "@/lib/types";
import { chainName, gwei, mon } from "@/lib/format";

export function Hero({ state }: { state: ArenaState | null }) {
  const rounds = state?.overall.rounds ?? 0;
  const meanSavingsPct = rounds > 0 ? state?.overall.meanSavingsPct ?? null : null;
  const saved =
    state ? BigInt(state.overall.cumulativeNaiveWei) - BigInt(state.overall.cumulativeCoordWei) : 0n;

  return (
    <section className="wrap pt-16 pb-14 sm:pt-24 sm:pb-20">
      <div className="grid grid-cols-1 items-end gap-12 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="eyebrow mb-6 flex items-center gap-2">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-naive" />
            {state ? `Live on ${chainName(state.chainId)}` : "Connecting to the arena…"}
          </div>
          <h1 className="text-balance text-[2.6rem] font-semibold leading-[1.03] tracking-tightest sm:text-[3.4rem]">
            Losing a keeper race costs
            <br className="hidden sm:block" /> almost as much as{" "}
            <span className="text-coord">winning it.</span>
          </h1>
          <p className="mt-6 max-w-xl text-pretty text-[17px] leading-relaxed text-ink-2">
            On Monad you pay for the gas limit you <em className="not-italic text-ink">declare</em>,
            not the gas you use. So when four bots race one liquidation, the three that revert are
            billed the full amount anyway. Truce moves the race onto a cheap reservation —
            everyone competes for pennies, one winner spends the rest.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Fact label="rounds run" value={rounds ? rounds.toLocaleString() : "—"} />
            <Fact label="gas price" value={state ? `${gwei(state.gasPriceWei)} gwei` : "—"} />
            <Fact label="MON saved so far" value={state ? mon(saved, 4) : "—"} />
          </div>
        </div>

        <HeroNumber meanSavingsPct={meanSavingsPct} />
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tnum font-mono text-lg text-ink">{value}</div>
      <div className="eyebrow mt-0.5">{label}</div>
    </div>
  );
}

function HeroNumber({ meanSavingsPct }: { meanSavingsPct: number | null }) {
  return (
    <div className="card relative overflow-hidden p-7">
      <div className="eyebrow">Mean gas billed, avoided</div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="tnum font-mono text-hero font-semibold text-coord">
          {meanSavingsPct === null ? "—" : meanSavingsPct.toFixed(2)}
        </span>
        <span className="font-mono text-2xl text-coord/70">%</span>
      </div>
      <p className="mt-3 text-[13.5px] leading-relaxed text-muted">
        live mean across completed experiment lanes — the drop in MON billed on Monad when
        keepers coordinate instead of racing.
      </p>
      <div className="mt-5 flex items-center gap-4 border-t border-hairline pt-4">
        <MiniBars />
        <div className="font-mono text-[11px] leading-tight text-muted">
          <div>
            <span className="text-naive">■</span> without · full price, win or lose
          </div>
          <div className="mt-1">
            <span className="text-coord">■</span> with · cheap claim, one execution
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniBars() {
  return (
    <div className="flex h-12 items-end gap-1.5" aria-hidden>
      <div className="w-3 rounded-t bg-naive" style={{ height: "100%" }} />
      <div className="w-3 rounded-t bg-naive" style={{ height: "100%" }} />
      <div className="w-3 rounded-t bg-naive" style={{ height: "100%" }} />
      <div className="w-3 rounded-t bg-naive" style={{ height: "100%" }} />
      <div className="mx-1 w-px self-stretch bg-hairline" />
      <div className="w-3 rounded-t bg-coord" style={{ height: "26%" }} />
      <div className="w-3 rounded-t bg-coord" style={{ height: "26%" }} />
      <div className="w-3 rounded-t bg-coord" style={{ height: "26%" }} />
      <div className="w-3 rounded-t bg-coord" style={{ height: "26%" }} />
      <div className="w-3 rounded-t bg-coord" style={{ height: "100%" }} />
    </div>
  );
}
