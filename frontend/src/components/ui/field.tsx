import * as React from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor?: string;
  helper?: React.ReactNode;
  optional?: boolean;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  htmlFor,
  helper,
  optional,
  action,
  children,
  className,
}: FieldProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label
          htmlFor={htmlFor}
          className="text-[13px] font-medium tracking-tight text-fg"
        >
          {label}
          {optional ? (
            <span className="ml-2 text-[11px] font-normal text-faint">Optional</span>
          ) : null}
        </label>
        {action}
      </div>
      {children}
      {helper ? <p className="text-xs leading-relaxed text-faint">{helper}</p> : null}
    </div>
  );
}
