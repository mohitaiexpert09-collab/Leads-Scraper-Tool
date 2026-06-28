import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import type { LeadStatus, Tier } from "@/lib/types";
import { STATUS_LABELS, TIER_LABELS } from "@/lib/types";

/* ---------------- Button ---------------- */
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand)]",
  {
    variants: {
      variant: {
        primary: "bg-[var(--color-brand)] text-white hover:brightness-110 shadow-[0_8px_24px_-10px_rgba(124,92,255,0.7)]",
        secondary: "bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-border)] hover:border-[var(--color-border-strong)]",
        ghost: "text-[var(--color-text-dim)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)]",
        danger: "bg-[var(--color-danger)] text-white hover:brightness-110",
      },
      size: {
        sm: "h-8 px-3",
        md: "h-9 px-4",
        lg: "h-11 px-6 text-base",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  )
);
Button.displayName = "Button";

/* ---------------- Card ---------------- */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("card", className)} {...props} />;
}
export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pt-5 pb-3", className)} {...props} />;
}
export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={cn("text-sm font-semibold text-[var(--color-text)]", className)} {...props} />;
}
export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

/* ---------------- Inputs ---------------- */
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-muted)] focus:border-[var(--color-brand)] focus:outline-none",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "h-9 rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] px-3 text-sm text-[var(--color-text)] focus:border-[var(--color-brand)] focus:outline-none",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
Select.displayName = "Select";

/* ---------------- Badges ---------------- */
export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium border border-[var(--color-border)]",
        className
      )}
      {...props}
    />
  );
}

const TIER_STYLES: Record<Tier, string> = {
  1: "bg-[var(--color-tier1)]/15 text-[var(--color-tier1)] border-[var(--color-tier1)]/30",
  2: "bg-[var(--color-tier2)]/15 text-[var(--color-tier2)] border-[var(--color-tier2)]/30",
  3: "bg-[var(--color-tier3)]/15 text-[var(--color-tier3)] border-[var(--color-tier3)]/30",
  4: "bg-[var(--color-tier4)]/15 text-[var(--color-tier4)] border-[var(--color-tier4)]/30",
};

export function TierBadge({ tier, withLabel = true }: { tier: Tier; withLabel?: boolean }) {
  return (
    <Badge className={TIER_STYLES[tier]}>
      <span className="font-bold">T{tier}</span>
      {withLabel && <span className="opacity-80">{TIER_LABELS[tier].split("· ")[1]}</span>}
    </Badge>
  );
}

const STATUS_STYLES: Record<LeadStatus, string> = {
  new: "bg-[var(--color-tier3)]/15 text-[var(--color-tier3)]",
  contacted: "bg-[var(--color-brand)]/15 text-[var(--color-brand)]",
  follow_up: "bg-[var(--color-warning)]/15 text-[var(--color-warning)]",
  replied: "bg-[var(--color-brand-2)]/15 text-[var(--color-brand-2)]",
  qualified: "bg-[var(--color-tier1)]/15 text-[var(--color-tier1)]",
  won: "bg-[var(--color-success)]/20 text-[var(--color-success)]",
  lost: "bg-[var(--color-danger)]/15 text-[var(--color-danger)]",
};

export function StatusBadge({ status }: { status: LeadStatus }) {
  return <Badge className={cn("border-transparent", STATUS_STYLES[status])}>{STATUS_LABELS[status]}</Badge>;
}

/* ---------------- Misc ---------------- */
export function EmptyState({ icon, title, hint }: { icon?: React.ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      {icon && <div className="text-[var(--color-muted)]">{icon}</div>}
      <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
      {hint && <p className="text-xs text-[var(--color-muted)] max-w-sm">{hint}</p>}
    </div>
  );
}

export function Avatar({ label }: { label: string }) {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--color-brand-soft)] text-xs font-semibold text-[var(--color-text)] border border-[var(--color-border)]">
      {label}
    </div>
  );
}
