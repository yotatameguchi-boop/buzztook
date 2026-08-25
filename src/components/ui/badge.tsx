import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

const TONES = {
  neutral: "border-line-strong bg-surface-2 text-ink-muted",
  brand: "border-brand-dim bg-brand-dim/15 text-brand",
  accent: "border-accent-dim bg-accent-dim/15 text-accent",
  good: "border-good/40 bg-good/10 text-good",
  mid: "border-mid/40 bg-mid/10 text-mid",
  bad: "border-bad/40 bg-bad/10 text-bad",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
