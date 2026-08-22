import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tables scroll inside their own container. The page body never scrolls
 * horizontally — see `overflow-x: clip` in globals.css.
 */
export function ScrollTable({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("table-scroll rounded-[8px] border border-line bg-panel", className)}>
      <table className="w-full min-w-[720px] border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <th
      className={cn(
        "label-micro sticky top-0 z-10 whitespace-nowrap border-b border-line bg-surface px-4 py-2.5",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "left",
  className,
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={cn(
        "whitespace-nowrap px-4 py-3 text-[13px] text-fg",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

export function Tr({
  children,
  highlight,
  className,
}: {
  children: React.ReactNode;
  highlight?: "bad" | "accent";
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "border-b border-line last:border-0 transition-colors hover:bg-surface/70",
        highlight === "bad" && "bg-bad-soft/40",
        highlight === "accent" && "bg-accent-soft/50",
        className,
      )}
    >
      {children}
    </tr>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: React.ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-10 text-center text-[13px] text-faint">
        {children}
      </td>
    </tr>
  );
}
