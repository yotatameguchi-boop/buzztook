import { cn } from "@/lib/utils";
import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";

const VARIANTS = {
  primary:
    "bg-brand text-canvas hover:bg-brand/90 disabled:bg-brand/40 disabled:text-canvas/70 font-semibold",
  secondary: "border border-line-strong bg-surface-2 text-ink hover:border-brand/60 hover:text-brand",
  ghost: "text-ink-muted hover:text-ink hover:bg-surface-2",
  danger: "border border-bad/40 text-bad hover:bg-bad/10",
} as const;

const SIZES = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-6 text-sm",
} as const;

type Variant = keyof typeof VARIANTS;
type Size = keyof typeof SIZES;

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg transition-colors disabled:cursor-not-allowed";

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button className={cn(base, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(base, VARIANTS[variant], SIZES[size], className)}>
      {children}
    </Link>
  );
}
