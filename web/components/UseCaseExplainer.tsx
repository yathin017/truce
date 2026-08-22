export function UseCaseExplainer() {
  return (
    <section id="use-cases" className="border-t border-hairline">
      <div className="wrap py-20 sm:py-28">
        <div className="max-w-3xl">
          <p className="eyebrow">The jobs behind the demo</p>
          <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.4rem]">
            First understand the opportunity. Then the keeper race.
          </h2>
          <p className="mt-4 max-w-2xl text-[16px] leading-relaxed text-ink-2">
            Truce does not invent liquidations or arbitrage, and it does not execute them itself.
            Those jobs already exist. Truce coordinates the bots competing to perform them, so only
            one bot pays for the expensive action.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LiquidationCard />
          <ArbitrageCard />
        </div>

        <div className="mt-8 grid grid-cols-1 overflow-hidden rounded-xl border border-hairline bg-raised/60 lg:grid-cols-3">
          <Takeaway
            n="01"
            title="The protocol exposes an opportunity"
            body="An unhealthy loan can be liquidated, or a pool price has moved away from its reference price."
          />
          <Takeaway
            n="02"
            title="Many keepers detect the same state"
            body="They construct success-sized transactions because none knows which transaction will land first."
          />
          <Takeaway
            n="03"
            title="Truce makes the expensive action exclusive"
            body="The bots race on a cheap claim. One wins the right to execute; every losing bot stops early."
          />
        </div>

        <div className="mt-8 rounded-xl border border-coord/25 bg-coord-tint px-5 py-4 sm:px-6">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-coord">
            Jury takeaway
          </p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">
            Truce does not remove competition. It moves competition from the expensive protocol
            transaction to a cheap reservation transaction, then lets exactly one winner do the
            real work through its own executor.
          </p>
        </div>
      </div>
    </section>
  );
}

function LiquidationCard() {
  return (
    <article className="card overflow-hidden">
      <CardHeader
        number="01"
        title="Lending liquidation"
        summary="A loan becomes unsafe after its collateral loses value."
      />
      <div className="space-y-6 p-6 sm:p-7">
        <div>
          <Label>Why liquidation exists</Label>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            A lending protocol lets Alice borrow against collateral. If that collateral can no
            longer safely cover her debt, an outside keeper may repay debt and receive collateral
            plus a liquidation bonus. This protects the protocol from bad debt.
          </p>
        </div>

        <ExampleBox>
          <Metric k="Initial collateral" v="$10,000" />
          <Metric k="Debt" v="$7,500" />
          <Metric k="Liquidation threshold" v="80%" />
          <div className="col-span-2 border-t border-hairline pt-3">
            <p className="font-mono text-[11px] text-muted">
              Health factor = collateral value × threshold ÷ debt
            </p>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-2">
              At $10,000 the health factor is <strong className="text-ink">1.07 — safe</strong>.
              If collateral falls to $8,000 it becomes <strong className="text-naive">0.85 — liquidatable</strong>.
            </p>
          </div>
        </ExampleBox>

        <RaceExplanation
          without="Four keepers see the same health factor below 1 and all submit a full liquidation. The first repays the position; the other three find it already liquidated or healthy and revert."
          withTruce="All four submit a small claim for that borrower. One claim wins, and only its executor calls liquidate. The other keepers never submit the expensive liquidation."
        />

        <DemoAction>
          The demo&apos;s execute transaction calls <Code>liquidate(user)</Code>, changes the demo
          position, and simulates the gas-heavy flash-loan, swap, repayment and collateral-seizure
          path of a real liquidation.
        </DemoAction>
      </div>
    </article>
  );
}

function ArbitrageCard() {
  return (
    <article className="card overflow-hidden">
      <CardHeader
        number="02"
        title="DEX arbitrage"
        summary="A pool price drifts away from the wider market price."
      />
      <div className="space-y-6 p-6 sm:p-7">
        <div>
          <Label>Why arbitrage exists</Label>
          <p className="mt-2 text-[14px] leading-relaxed text-muted">
            Trades change the token ratio inside an automated market maker, so its price can differ
            from a reference market. An arbitrage keeper trades against that difference, earns the
            spread, and pushes the pool back toward the reference price.
          </p>
        </div>

        <ExampleBox>
          <Metric k="Reference MON price" v="$10.00" />
          <Metric k="DEX MON price" v="$10.50" />
          <Metric k="Price gap" v="5%" />
          <div className="col-span-2 border-t border-hairline pt-3">
            <p className="text-[13.5px] leading-relaxed text-ink-2">
              MON is overpriced in this pool. A keeper sources MON near $10.00 and sells it into
              the pool near $10.50. That sale pushes the pool price down and closes the gap.
            </p>
          </div>
        </ExampleBox>

        <RaceExplanation
          without="Four keepers detect the same gap and submit the same expensive route. The first trade corrects the price; later transactions revert on their price/slippage checks or have no profitable spread left."
          withTruce="All four first claim the pool opportunity. One wins, then its executor runs the arbitrage route. The losing keepers stop before borrowing funds or performing swaps."
        />

        <DemoAction>
          The demo&apos;s execute transaction calls <Code>arb()</Code>, moves the mock pool price back
          to its oracle price, and simulates the gas-heavy flash-loan and multi-hop swap work of a
          real arbitrage.
        </DemoAction>
      </div>
    </article>
  );
}

function CardHeader({ number, title, summary }: { number: string; title: string; summary: string }) {
  return (
    <header className="border-b border-hairline bg-raised/70 p-6 sm:p-7">
      <div className="flex items-center gap-3">
        <span className="tnum font-mono text-[11px] text-coord">{number}</span>
        <h3 className="text-[20px] font-semibold tracking-tight">{title}</h3>
      </div>
      <p className="mt-2 text-[14px] text-muted">{summary}</p>
    </header>
  );
}

function RaceExplanation({ without, withTruce }: { without: string; withTruce: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-naive/20 bg-naive-tint p-4">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-naive">
          Without Truce
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{without}</p>
      </div>
      <div className="rounded-lg border border-coord/20 bg-coord-tint p-4">
        <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-coord">
          With Truce
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{withTruce}</p>
      </div>
    </div>
  );
}

function ExampleBox({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 rounded-lg border border-hairline bg-raised/60 p-4">{children}</div>;
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <p className="tnum font-mono text-[14px] font-semibold text-ink">{v}</p>
      <p className="mt-0.5 font-mono text-[10px] uppercase tracking-[0.1em] text-muted">{k}</p>
    </div>
  );
}

function DemoAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-coord pl-4">
      <Label>What execute means in this demo</Label>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{children}</p>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <p className="font-mono text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink">{children}</p>;
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="rounded bg-raised px-1.5 py-0.5 font-mono text-[11px] text-ink">{children}</code>;
}

function Takeaway({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="border-b border-hairline p-5 last:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0 sm:p-6">
      <p className="tnum font-mono text-[11px] text-faint">{n}</p>
      <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
