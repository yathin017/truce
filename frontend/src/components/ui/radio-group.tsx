"use client";

import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { cn } from "@/lib/utils";

export const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Root ref={ref} className={cn("grid gap-2", className)} {...props} />
));
RadioGroup.displayName = "RadioGroup";

export const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "size-[16px] shrink-0 rounded-full border border-line-strong bg-surface outline-none transition-colors",
      "hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/40",
      "data-[state=checked]:border-accent",
      className,
    )}
    {...props}
  >
    <RadioGroupPrimitive.Indicator className="flex size-full items-center justify-center">
      <span className="size-[7px] rounded-full bg-accent" />
    </RadioGroupPrimitive.Indicator>
  </RadioGroupPrimitive.Item>
));
RadioGroupItem.displayName = "RadioGroupItem";

/** Radio rendered as a selectable option row/card. */
export function RadioCard({
  value,
  id,
  title,
  description,
  checked,
  className,
}: {
  value: string;
  id: string;
  title: string;
  description?: string;
  checked?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-md border p-3.5 transition-colors",
        checked
          ? "border-accent/50 bg-accent/[0.06]"
          : "border-line bg-surface hover:border-line-strong",
        className,
      )}
    >
      <RadioGroupItem value={value} id={id} className="mt-0.5" />
      <span className="space-y-1">
        <span className="block text-[13px] font-medium text-fg">{title}</span>
        {description ? (
          <span className="block text-xs leading-relaxed text-muted">{description}</span>
        ) : null}
      </span>
    </label>
  );
}
