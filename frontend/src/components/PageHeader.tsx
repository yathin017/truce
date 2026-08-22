import * as React from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  subtitle,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  subtitle?: React.ReactNode;
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4 pb-6", className)}>
      <div>
        {eyebrow ? <div className="label-micro mb-2">{eyebrow}</div> : null}
        <h1 className="text-[26px] leading-none font-semibold tracking-[-0.02em] text-fg">
          {title}
        </h1>
        {subtitle ? (
          <p className="mt-2.5 max-w-2xl text-[13.5px] leading-relaxed text-muted">
            {subtitle}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2.5">{actions}</div> : null}
    </div>
  );
}

export function SectionHeader({
  title,
  description,
  actions,
  className,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3.5 flex items-end justify-between gap-4", className)}>
      <div>
        <h2 className="text-[15px] font-semibold tracking-tight text-fg">{title}</h2>
        {description ? (
          <p className="mt-1 text-[13px] text-muted">{description}</p>
        ) : null}
      </div>
      {actions}
    </div>
  );
}
