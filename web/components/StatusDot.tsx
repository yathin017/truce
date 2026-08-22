export function StatusDot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="relative flex h-2 w-2">
        {on && (
          <span className="absolute inline-flex h-full w-full animate-pulse-dot rounded-full bg-coord" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${on ? "bg-coord" : "bg-faint"}`}
        />
      </span>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">{label}</span>
    </span>
  );
}
