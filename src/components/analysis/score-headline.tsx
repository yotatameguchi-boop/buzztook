import { Badge } from "@/components/ui/badge";
import { toTopPercentText } from "@/lib/analysis/percentile";
import type { ConfidenceLevel } from "@/lib/domain/types";
import { CONFIDENCE_LABELS } from "@/lib/domain/types";
import { percentileTone } from "@/lib/utils";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

const CONFIDENCE_TONE = { HIGH: "good", MEDIUM: "mid", LOW: "bad" } as const;

/**
 * 総合バズポテンシャル（仕様書 §23 Task 6）。
 * 仕様書 §8 に従い「82点」より「上位12%」を優先して表示する。
 */
export function ScoreHeadline({
  percentile,
  score,
  confidence,
  populationLabel,
}: {
  percentile: number;
  score: number;
  confidence: ConfidenceLevel;
  populationLabel: string;
}) {
  const tone = percentileTone(percentile);

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
      <div>
        <p className="text-xs font-medium tracking-wide text-ink-muted">総合バズポテンシャル</p>
        <p className={`mt-1 text-5xl font-black tracking-tight tabular ${TONE_TEXT[tone]}`}>
          {toTopPercentText(percentile)}
        </p>
        <p className="mt-1 text-xs text-ink-faint">{populationLabel}内での位置</p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-ink-faint">内部スコア</span>
          <span className="text-sm font-semibold text-ink tabular">{score.toFixed(1)}</span>
          <span className="text-[11px] text-ink-faint">/ 100</span>
        </div>
        <Badge tone={CONFIDENCE_TONE[confidence]}>
          予測信頼度：{CONFIDENCE_LABELS[confidence]}
        </Badge>
      </div>
    </div>
  );
}
