import { ARENA_URL } from "@/lib/arena";

export function OfflineBanner() {
  return (
    <div className="border-b border-naive/30 bg-naive-tint">
      <div className="wrap flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-naive">
          Arena offline
        </span>
        <span className="font-mono text-[12px] text-ink-2">
          start the engine, then this page goes live:
        </span>
        <code className="rounded bg-surface px-2 py-0.5 font-mono text-[11.5px] text-ink">
          pnpm --filter @reservoir/arena serve --chain 10143
        </code>
        <span className="font-mono text-[11px] text-muted">expecting {ARENA_URL}</span>
      </div>
    </div>
  );
}
