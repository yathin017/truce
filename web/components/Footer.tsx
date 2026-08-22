import type { ArenaState } from "@/lib/types";
import { shortHash } from "@/lib/format";

export function Footer({ state }: { state: ArenaState | null }) {
  const coordinator = state?.coordinator;
  const explorer = state?.explorerBase && coordinator ? `${state.explorerBase}/address/${coordinator}` : undefined;

  return (
    <footer className="border-t border-hairline">
      <div className="wrap py-20">
        <div className="grid grid-cols-1 gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <p className="eyebrow">One primitive, any task</p>
            <h2 className="mt-3 max-w-lg text-[1.7rem] font-semibold leading-tight tracking-tight">
              The coordinator has no idea what a liquidation is.
            </h2>
            <p className="mt-4 max-w-lg text-[14.5px] leading-relaxed text-muted">
              It never runs the work and never touches user funds. It only checks that the
              opportunity is still live — a health factor, a price gap, an elapsed interval — and
              hands one keeper the exclusive right to act. That is why the same contract runs all
              three tasks above, and why any protocol could add a fourth.
            </p>
            {coordinator && (
              <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-hairline bg-surface px-3 py-2">
                <span className="eyebrow">Coordinator</span>
                {explorer ? (
                  <a
                    href={explorer}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-[12px] text-ink underline decoration-hairline underline-offset-2 hover:decoration-ink"
                  >
                    {shortHash(coordinator, 8, 6)} ↗
                  </a>
                ) : (
                  <span className="font-mono text-[12px] text-ink">{shortHash(coordinator, 8, 6)}</span>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            <Note title="Honest scope">
              This is keeper-side coordination, not protocol-enforced exclusivity. In the demo the
              mock market honors the claim — a one-line integration any protocol can adopt. Without
              it, participating keepers still save against each other.
            </Note>
            <Note title="Complementary to Chainlink SVR">
              SVR recaptures oracle value from the winning liquidation. Reservoir eliminates the
              wasted gas from the losing attempts. Different problem, same stack.
            </Note>
            <Note title="Demo market">
              The lending pool, DEX pool and cron job are labelled mocks with the same interfaces as
              the real thing — so the experiment is deterministic, not a live-mainnet gamble.
            </Note>
          </div>
        </div>

        <div className="mt-16 flex flex-col items-start justify-between gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-faint">
            Reservoir · built for the Monad hackathon
          </span>
          <span className="font-mono text-[11px] text-faint">stake your claim before you spend your gas</span>
        </div>
      </div>
    </footer>
  );
}

function Note({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-hairline pl-4">
      <h3 className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">{title}</h3>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}
