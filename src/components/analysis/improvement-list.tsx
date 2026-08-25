import { Badge } from "@/components/ui/badge";
import type { Improvement } from "@/lib/domain/types";
import { CONFIDENCE_LABELS, IMPACT_LABELS, METRIC_LABELS } from "@/lib/domain/types";

/**
 * 改善提案（仕様書 §13）。
 * 仕様書 §22-2 に従い、DATA INSIGHT（データ根拠あり）と AI SUGGESTION（生成AIの提案）を
 * UI 上で明確に区別する。
 */
export function ImprovementList({ improvements }: { improvements: Improvement[] }) {
  if (improvements.length === 0) {
    return (
      <p className="px-5 py-6 text-sm text-ink-muted">
        大きな改善点は検出されませんでした。撮影・編集フェーズに進んで問題ありません。
      </p>
    );
  }

  return (
    <ol className="divide-y divide-line">
      {improvements.map((improvement, index) => (
        <li key={improvement.id} className="px-5 py-4">
          <div className="flex items-start gap-4">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md border border-line-strong bg-surface-2 text-xs font-bold text-ink-muted tabular">
              {index + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                {improvement.evidence === "DATA_INSIGHT" ? (
                  <Badge tone="brand">DATA INSIGHT</Badge>
                ) : (
                  <Badge tone="accent">AI SUGGESTION</Badge>
                )}
                <span className="text-[11px] text-ink-faint">
                  {METRIC_LABELS[improvement.relatedMetric]}
                </span>
              </div>

              <p className="mt-2 text-sm font-semibold text-ink">{improvement.title}</p>
              <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{improvement.detail}</p>

              {improvement.evidenceNote ? (
                <p className="mt-2 rounded-md border border-line bg-surface-2 px-2.5 py-1.5 text-[11px] text-ink-faint">
                  根拠：{improvement.evidenceNote}
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-ink-faint">
                  ※ この提案は台本の傾向からの生成案です。実データによる裏付けはありません。
                </p>
              )}
            </div>

            <div className="flex w-28 shrink-0 flex-col items-end gap-1.5">
              <span className="text-[11px] text-ink-faint">
                予測影響：<span className="text-ink-muted">{IMPACT_LABELS[improvement.impact]}</span>
              </span>
              <span className="text-[11px] text-ink-faint">
                信頼度：
                <span className="text-ink-muted">{CONFIDENCE_LABELS[improvement.confidence]}</span>
              </span>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
