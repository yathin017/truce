"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FlaskConical, Moon, Radio, Server, Sun, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTheme } from "@/providers/ThemeProvider";
import { MONAD_TESTNET, loadDeployment } from "@/lib/chain";
import { formatGwei } from "@/lib/gas";
import { HEAD_BLOCK, baseFeeWei } from "@/services/truce";
import { NetworkSelector } from "./NetworkSelector";
import { WalletButton } from "./WalletButton";

const NAV = [
  { href: "/tasks", label: "Tasks", icon: Server },
  { href: "/keeper", label: "Keeper", icon: Radio },
  { href: "/register", label: "Register", icon: Terminal },
  { href: "/experiment", label: "Experiment", icon: FlaskConical },
];

export function Rail() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1560px] items-center gap-5 px-4 lg:px-7">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <TruceMark />
          <span className="font-display text-[15px] font-semibold tracking-[0.18em] text-fg">
            TRUCE
          </span>
        </Link>

        <nav className="hidden items-center gap-0.5 md:flex">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex items-center gap-2 rounded-md px-3 py-1.5 text-[13px] transition-colors",
                  active
                    ? "bg-elevated text-fg"
                    : "text-muted hover:bg-elevated/60 hover:text-fg",
                )}
              >
                <Icon className={cn("size-3.5", active ? "text-accent" : "text-faint")} />
                {item.label}
                {active && (
                  <span className="absolute inset-x-3 -bottom-[9px] h-[2px] rounded-full bg-accent" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <NetworkSelector />
          <WalletButton />
        </div>
      </div>

      <ChainStrip />

      <nav className="flex items-center gap-1 overflow-x-auto border-t border-line px-4 py-2 md:hidden">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-md px-3 py-1.5 text-[12.5px]",
                active ? "bg-elevated text-fg" : "text-muted",
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}

function ChainStrip() {
  const deploy = loadDeployment(MONAD_TESTNET.id);
  const [block, setBlock] = React.useState(HEAD_BLOCK);

  React.useEffect(() => {
    const id = window.setInterval(
      () => setBlock((b) => b + 1),
      MONAD_TESTNET.blockMs * 4,
    );
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="hidden items-center gap-6 border-t border-line bg-surface/60 px-4 py-1.5 lg:flex">
      <div className="mx-auto flex w-full max-w-[1560px] items-center gap-6 lg:px-3">
        <Field label="chain">{MONAD_TESTNET.name}</Field>
        <Field label="head">
          <span className="text-fg">{block.toLocaleString("en-US")}</span>
          <span className="ml-1.5 inline-block size-1.5 animate-[truce-pulse_1.6s_ease-in-out_infinite] rounded-full bg-ok align-middle" />
        </Field>
        <Field label="block">{MONAD_TESTNET.blockMs}ms</Field>
        <Field label="base fee">{formatGwei(baseFeeWei())} gwei</Field>
        <Field label="coordinator" className="ml-auto">
          {deploy.coordinator.slice(0, 10)}…{deploy.coordinator.slice(-4)}
        </Field>
        {deploy.source === "placeholder" ? (
          <span
            className="rounded-[4px] border border-warn/40 bg-warn/10 px-2 py-[3px] font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-warn"
            title="Deploy.s.sol has not written packages/shared/deployments/<chainId>.json yet — these addresses and all state below are placeholders."
          >
            mock state
          </span>
        ) : null}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("flex items-baseline gap-2", className)}>
      <span className="label-micro">{label}</span>
      <span className="font-mono text-[11.5px] text-muted" data-numeric>
        {children}
      </span>
    </span>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      title={theme === "dark" ? "Switch to light" : "Switch to dark"}
      aria-label="Toggle theme"
      className="flex size-9 items-center justify-center rounded-md border border-line bg-panel text-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </button>
  );
}

export function TruceMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "relative flex size-6 items-center justify-center rounded-[5px] border border-accent/40 bg-accent/10",
        className,
      )}
    >
      <span className="absolute h-[9px] w-[2px] rounded-full bg-accent" />
      <span className="absolute h-[2px] w-[9px] rounded-full bg-accent/45" />
    </span>
  );
}
