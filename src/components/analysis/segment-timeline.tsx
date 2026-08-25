import type { StructureSegment } from "@/lib/domain/types";

const SEGMENT_COLOR: Record<StructureSegment["key"], string> = {
  HOOK: "bg-brand",
  CONTEXT: "bg-brand-dim",
  DEVELOPMENT: "bg-line-strong",
  PEAK: "bg-accent",
  ENDING: "bg-accent-dim",
};

/**
 * 台本の構造分解（仕様書 §7-6）。
 * HOOK → CONTEXT → DEVELOPMENT → PEAK → ENDING を尺の中での位置とともに示す。
 */
export function SegmentTimeline({ segments }: { segments: StructureSegment[] }) {
  if (segments.length === 0) {
    return <p className="text-sm text-ink-muted">構造を検出できませんでした。</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-2">
        {segments.map((segment) => (
          <div
            key={segment.key}
            className={SEGMENT_COLOR[segment.key]}
            style={{ width: `${Math.max(2, (segment.endRatio - segment.startRatio) * 100)}%` }}
            title={`${segment.label}（${segment.estimatedStartSeconds}秒〜）`}
          />
        ))}
      </div>

      <ul className="space-y-2.5">
        {segments.map((segment) => (
          <li key={segment.key} className="flex gap-3">
            <div className="flex w-24 shrink-0 items-start gap-2">
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${SEGMENT_COLOR[segment.key]}`} />
              <div>
                <p className="text-xs font-semibold text-ink">{segment.label}</p>
                <p className="text-[11px] text-ink-faint tabular">
                  {segment.estimatedStartSeconds}秒〜
                </p>
              </div>
            </div>
            <p className="min-w-0 flex-1 text-xs leading-relaxed text-ink-muted">
              {segment.text.length > 120 ? `${segment.text.slice(0, 120)}…` : segment.text}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
