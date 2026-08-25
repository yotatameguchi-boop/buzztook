import { toTopPercentText } from "@/lib/analysis/percentile";
import type { PopulationResult } from "@/lib/domain/types";
import { POPULATION_LABELS } from "@/lib/domain/types";
import { percentileTone } from "@/lib/utils";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

/** 比較母集団ごとの位置（仕様書 §9）。何と比べたかで評価が変わることを明示する。 */
export function PopulationList({ populations }: { populations: PopulationResult[] }) {
  return (
    <ul className="divide-y divide-line">
      {populations.map((population) => (
        <li key={population.key} className="flex items-center justify-between gap-4 py-2.5">
          <div className="min-w-0">
            <p className="text-sm text-ink">{POPULATION_LABELS[population.key]}</p>
            {population.note ? (
              <p className="mt-0.5 text-[11px] text-ink-faint">{population.note}</p>
            ) : (
              <p className="mt-0.5 text-[11px] text-ink-faint tabular">
                母集団サイズ {population.sampleSize.toLocaleString("ja-JP")}
              </p>
            )}
          </div>
          {population.available ? (
            <span
              className={`shrink-0 text-lg font-bold tabular ${TONE_TEXT[percentileTone(population.percentile)]}`}
            >
              {toTopPercentText(population.percentile)}
            </span>
          ) : (
            <span className="shrink-0 text-xs text-ink-faint">データ不足</span>
          )}
        </li>
      ))}
    </ul>
  );
}
