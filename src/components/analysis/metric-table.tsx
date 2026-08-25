import { Badge } from "@/components/ui/badge";
import { toTopPercentText } from "@/lib/analysis/percentile";
import type { MetricResult } from "@/lib/domain/types";
import { CONFIDENCE_LABELS, METRIC_DESCRIPTIONS, METRIC_LABELS } from "@/lib/domain/types";
import { percentileTone } from "@/lib/utils";

const TONE_BAR = { good: "bg-good", mid: "bg-mid", bad: "bg-bad" } as const;
const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;
const CONFIDENCE_TONE = { HIGH: "good", MEDIUM: "mid", LOW: "bad" } as const;

/**
 * 10項目の詳細（仕様書 §7 / §23 Task 6）。
 * 内部スコアとパーセンタイルを併記しつつ、判断根拠（特徴量）も開示する。
 */
export function MetricTable({ metrics }: { metrics: MetricResult[] }) {
  return (
    <div className="divide-y divide-line">
      {metrics.map((metric) => {
        const tone = percentileTone(metric.percentile);
        return (
          <details key={metric.key} className="group px-5 py-3.5">
            <summary className="flex cursor-pointer list-none items-center gap-4">
              <div className="w-40 shrink-0">
                <p className="text-sm font-medium text-ink">{METRIC_LABELS[metric.key]}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink-faint">
                  {METRIC_DESCRIPTIONS[metric.key]}
                </p>
              </div>

              <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={`h-full rounded-full ${TONE_BAR[tone]}`}
                  style={{ width: `${Math.max(2, metric.percentile)}%` }}
                />
              </div>

              <div className="flex w-44 shrink-0 items-center justify-end gap-3">
                <span className="text-[11px] text-ink-faint tabular">
                  {metric.normalizedScore.toFixed(0)}点
                </span>
                <span className={`w-16 text-right text-sm font-bold tabular ${TONE_TEXT[tone]}`}>
                  {toTopPercentText(metric.percentile)}
                </span>
                <Badge tone={CONFIDENCE_TONE[metric.confidence]}>
                  {CONFIDENCE_LABELS[metric.confidence]}
                </Badge>
              </div>
            </summary>

            <div className="mt-3 space-y-1 border-l-2 border-line pl-4">
              {metric.notes.map((note, index) => (
                <p key={index} className="text-xs leading-relaxed text-ink-muted">
                  ・{note}
                </p>
              ))}
              <p className="pt-1 text-[11px] text-ink-faint tabular">
                生スコア {metric.rawScore.toFixed(3)} → 補正後 {metric.normalizedScore.toFixed(1)} →
                パーセンタイル {metric.percentile.toFixed(1)}
              </p>
            </div>
          </details>
        );
      })}
    </div>
  );
}
