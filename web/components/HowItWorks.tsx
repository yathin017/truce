export function HowItWorks() {
  return (
    <section id="how" className="border-t border-hairline bg-raised/60">
      <div className="wrap py-20 sm:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 text-[2rem] font-semibold leading-tight tracking-tight sm:text-[2.4rem]">
            Move the race off the expensive transaction.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
            A keeper is an unaffiliated bot that gets paid to perform an on-chain action — liquidate
            a loan, arbitrage a pool, run a job. Many bots watch the same opportunity, so they race.
            Only one can win. The question Monad forces is: <em className="not-italic text-ink">what
            do the losers pay?</em>
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-x-10 gap-y-12 lg:grid-cols-[0.9fr_1.1fr]">
          <ol className="space-y-8">
            <Step
              n="01"
              title="Monad bills the limit you declare"
              body="Leaders propose blocks before executing them, so gas is charged at proposal time — from the limit in your transaction, not the gas it ends up using. Declare 500k, pay 500k, even if you revert in the first 5%."
            />
            <Step
              n="02"
              title="So losing a race is nearly as expensive as winning"
              body="A keeper must declare the success-sized limit or it runs out of gas when it wins. Four bots race one liquidation: one lands, three revert at the health check — and all four are billed the full 500k. Three-quarters of the gas does no work."
            />
            <Step
              n="03"
              title="Reservoir adds a cheap reservation"
              body="Bots first compete with a small bonded claim. The one winner then runs the expensive execution; the losers paid only for the claim and stand down. One contract does this for any task — it just checks that the opportunity is still live."
            />
          </ol>

          <FlowDiagram />
        </div>
      </div>
    </section>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr] gap-4">
      <span className="tnum font-mono text-[13px] text-faint">{n}</span>
      <div>
        <h3 className="text-[17px] font-semibold tracking-tight">{title}</h3>
        <p className="mt-1.5 text-[14.5px] leading-relaxed text-muted">{body}</p>
      </div>
    </li>
  );
}

function FlowDiagram() {
  return (
    <div className="card p-6 sm:p-8">
      <Flow
        tone="naive"
        label="Without Reservoir"
        note="four full-price attempts"
        chips={["500k", "500k", "500k", "500k"]}
        result="1 executes · 3 revert — all billed 500k"
      />
      <div className="my-6 rule" />
      <Flow
        tone="coord"
        label="With Reservoir"
        note="four cheap claims, one execution"
        chips={["claim", "claim", "claim", "claim"]}
        extra="500k"
        result="losers paid ~200k · one winner executes"
      />
    </div>
  );
}

function Flow({
  tone,
  label,
  note,
  chips,
  extra,
  result,
}: {
  tone: "naive" | "coord";
  label: string;
  note: string;
  chips: string[];
  extra?: string;
  result: string;
}) {
  const labelClass = tone === "naive" ? "text-naive" : "text-coord";
  return (
    <div>
      <div className="mb-4 flex items-baseline justify-between">
        <span className={`font-mono text-[12px] font-semibold uppercase tracking-[0.12em] ${labelClass}`}>
          {label}
        </span>
        <span className="font-mono text-[11px] text-muted">{note}</span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {chips.map((c, i) => (
          <Chip key={i} tone={tone} big={tone === "naive"}>
            {c}
          </Chip>
        ))}
        {extra && (
          <>
            <span className="px-1 font-mono text-muted">→</span>
            <Chip tone={tone} big>
              {extra}
            </Chip>
          </>
        )}
      </div>
      <p className="mt-3 font-mono text-[12px] text-ink-2">{result}</p>
    </div>
  );
}

function Chip({
  children,
  tone,
  big,
}: {
  children: React.ReactNode;
  tone: "naive" | "coord";
  big?: boolean;
}) {
  const base =
    tone === "naive"
      ? "border-naive/30 bg-naive-tint text-naive"
      : "border-coord/30 bg-coord-tint text-coord";
  return (
    <span
      className={`inline-flex items-center rounded-md border font-mono text-[11px] font-medium ${base} ${
        big ? "px-3 py-1.5" : "px-2.5 py-1"
      }`}
    >
      {children}
    </span>
  );
}
