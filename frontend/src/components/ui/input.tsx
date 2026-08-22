"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-10 w-full rounded-md border border-line bg-surface px-3 text-sm text-fg outline-none transition-colors",
      "placeholder:text-faint",
      "hover:border-line-strong focus:border-accent/70 focus:ring-2 focus:ring-accent/15",
      "disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "min-h-[92px] w-full resize-y rounded-md border border-line bg-surface px-3 py-2.5 text-sm text-fg outline-none transition-colors",
      "placeholder:text-faint",
      "hover:border-line-strong focus:border-accent/70 focus:ring-2 focus:ring-accent/15",
      className,
    )}
    {...props}
  />
));
Textarea.displayName = "Textarea";
