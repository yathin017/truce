import Link from "next/link";
import type { ArenaState } from "@/lib/types";
import { chainName } from "@/lib/format";
import { StatusDot } from "./StatusDot";

export function Nav({
  connected,
  state,
  active,
}: {
  connected: boolean;
  state: ArenaState | null;
  active?: "home" | "experiment";
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-hairline bg-paper/85 backdrop-blur-md">
      <div className="wrap flex h-14 items-center justify-between">
        <Link href="/" className="flex items-center gap-3">
          <Mark />
          <span className="font-semibold tracking-tight">Truce</span>
          <span className="hidden text-muted sm:inline">·</span>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted sm:inline">
            keeper coordination for Monad
          </span>
        </Link>
        <div className="flex items-center gap-4 sm:gap-6">
          <nav className="flex items-center gap-4">
            <NavLink href="/" label="Console" on={active === "home"} />
            <NavLink href="/experiment" label="Experiment" on={active === "experiment"} />
          </nav>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.14em] text-muted md:inline">
            {state ? chainName(state.chainId) : "—"}
          </span>
          <StatusDot on={connected} label={connected ? "live" : "offline"} />
        </div>
      </div>
    </header>
  );
}

function NavLink({ href, label, on }: { href: string; label: string; on: boolean }) {
  return (
    <Link
      href={href}
      className={`font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ${
        on ? "text-ink" : "text-muted hover:text-ink"
      }`}
    >
      {label}
    </Link>
  );
}

function Mark() {
  // Two stacked bars: a tall "expensive" one and a short "cheap" one — the whole idea.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="shrink-0">
      <rect x="2" y="2" width="5" height="14" rx="1.5" fill="#C4551D" />
      <rect x="9.5" y="9" width="5" height="7" rx="1.5" fill="#118A64" />
    </svg>
  );
}
