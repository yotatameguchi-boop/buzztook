/**
 * BuzzTook 独自の菱形チャート（仕様書 §10 / §23 Task 5）
 *
 * レーダーチャートは使わない。4つの軸を菱形の頂点に配置し、
 * 「独自性」だけは中央に配置する（仕様書の概念図に従う）。
 *
 *                引き込み
 *                  ▲
 *         刺さり ◀ ● ▶ 構成力     ● = 独自性（中央表示）
 *                  ▼
 *                拡散力
 *
 * 各頂点にはスコアではなくパーセンタイル（上位○%）を表示する（仕様書 §8）。
 */

import type { AxisResult } from "@/lib/domain/types";
import { AXIS_LABELS } from "@/lib/domain/types";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { percentileTone } from "@/lib/utils";

const TONE_COLOR = {
  good: "var(--color-good)",
  mid: "var(--color-mid)",
  bad: "var(--color-bad)",
} as const;

const WIDTH = 470;
const HEIGHT = 400;
const CX = WIDTH / 2;
const CY = HEIGHT / 2 - 6;
const RADIUS = 124;

/** 頂点の方向。菱形なので上下左右の4方向のみ。 */
const VERTEX = {
  attraction: { dx: 0, dy: -1 },
  resonance: { dx: -1, dy: 0 },
  structure: { dx: 1, dy: 0 },
  spread: { dx: 0, dy: 1 },
} as const;

type VertexKey = keyof typeof VERTEX;

const VERTEX_ORDER: VertexKey[] = ["attraction", "structure", "spread", "resonance"];

function pointAt(key: VertexKey, ratio: number) {
  const { dx, dy } = VERTEX[key];
  return {
    x: CX + dx * RADIUS * ratio,
    y: CY + dy * RADIUS * ratio,
  };
}

function diamondPath(ratio: number) {
  return VERTEX_ORDER.map((key) => {
    const { x, y } = pointAt(key, ratio);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

export function DiamondChart({ axes }: { axes: AxisResult[] }) {
  const byKey = new Map(axes.map((axis) => [axis.key, axis]));
  const originality = byKey.get("originality");

  const valuePoints = VERTEX_ORDER.map((key) => {
    const axis = byKey.get(key);
    // 表示はパーセンタイル基準（上位に行くほど外側に伸びる）
    const ratio = Math.max(0.06, (axis?.percentile ?? 0) / 100);
    return pointAt(key, ratio);
  });

  const polygon = valuePoints.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const originalityRatio = (originality?.percentile ?? 0) / 100;
  const originalityRadius = 12 + originalityRatio * 30;

  return (
    <div className="flex flex-col items-center">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full max-w-[470px]"
        role="img"
        aria-label="5軸の分析結果を示す菱形チャート"
      >
        <defs>
          <linearGradient id="buzz-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand)" stopOpacity="0.45" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.25" />
          </linearGradient>
          <radialGradient id="buzz-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.95" />
            <stop offset="70%" stopColor="var(--color-accent)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0.05" />
          </radialGradient>
        </defs>

        {/* 目盛りの菱形（25% 刻み） */}
        {[0.25, 0.5, 0.75, 1].map((ratio) => (
          <polygon
            key={ratio}
            points={diamondPath(ratio)}
            fill="none"
            stroke="var(--color-line)"
            strokeWidth={ratio === 1 ? 1.4 : 1}
          />
        ))}

        {/* 中心から各頂点への軸線 */}
        {VERTEX_ORDER.map((key) => {
          const end = pointAt(key, 1);
          return (
            <line
              key={key}
              x1={CX}
              y1={CY}
              x2={end.x}
              y2={end.y}
              stroke="var(--color-line)"
              strokeWidth={1}
            />
          );
        })}

        {/* 実測値のポリゴン */}
        <polygon
          points={polygon}
          fill="url(#buzz-fill)"
          stroke="var(--color-brand)"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* 各頂点のマーカー */}
        {VERTEX_ORDER.map((key, index) => {
          const axis = byKey.get(key);
          const point = valuePoints[index];
          const tone = TONE_COLOR[percentileTone(axis?.percentile ?? 0)];
          return (
            <g key={key}>
              <circle cx={point.x} cy={point.y} r={5} fill={tone} stroke="var(--color-canvas)" strokeWidth={2}>
                <title>
                  {AXIS_LABELS[key]}：{toTopPercentText(axis?.percentile ?? 0)}
                </title>
              </circle>
            </g>
          );
        })}

        {/* 中央 ＝ 独自性（仕様書 §10「独自性：別表示または中央表示」） */}
        <circle cx={CX} cy={CY} r={originalityRadius} fill="url(#buzz-core)" />
        <circle
          cx={CX}
          cy={CY}
          r={originalityRadius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth={1.5}
          strokeDasharray="3 3"
        >
          <title>独自性：{toTopPercentText(originality?.percentile ?? 0)}</title>
        </circle>
        <text
          x={CX}
          y={CY + 4}
          textAnchor="middle"
          className="tabular"
          fontSize="12"
          fontWeight="700"
          fill="var(--color-ink)"
        >
          {toTopPercentText(originality?.percentile ?? 0)}
        </text>
        <text x={CX} y={CY + 20} textAnchor="middle" fontSize="9" fill="var(--color-ink-faint)">
          独自性
        </text>

        {/* 頂点ラベル */}
        {VERTEX_ORDER.map((key) => {
          const axis = byKey.get(key);
          const anchorPoint = pointAt(key, 1);
          const { dx, dy } = VERTEX[key];
          const x = anchorPoint.x + dx * 22;
          const y = anchorPoint.y + dy * 34;
          const textAnchor = dx === 0 ? "middle" : dx > 0 ? "start" : "end";
          const tone = TONE_COLOR[percentileTone(axis?.percentile ?? 0)];
          return (
            <g key={key}>
              <text
                x={x}
                y={dy < 0 ? y : y - 12}
                textAnchor={textAnchor}
                fontSize="12"
                fontWeight="600"
                fill="var(--color-ink-muted)"
              >
                {AXIS_LABELS[key]}
              </text>
              <text
                x={x}
                y={dy < 0 ? y + 16 : y + 4}
                textAnchor={textAnchor}
                className="tabular"
                fontSize="14"
                fontWeight="700"
                fill={tone}
              >
                {toTopPercentText(axis?.percentile ?? 0)}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
