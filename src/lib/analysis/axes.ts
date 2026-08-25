/**
 * 10項目 → ユーザー表示用5軸への集約（仕様書 §10）。
 *
 * 内部評価は10項目のまま保持し、表示だけを5軸にする。
 * 軸内の重みは Ver.1 では均等。
 * TODO(Phase 5): どちらの項目が成果に効くかを学習して軸内重みを最適化する。
 */

import type { AxisResult, ConfidenceLevel, GenreKey, MetricResult } from "@/lib/domain/types";
import { AXIS_COMPOSITION, AXIS_KEYS } from "@/lib/domain/types";
import { metricPercentile } from "./percentile";

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** 軸の信頼度は、構成する項目のうち最も低いものに合わせる（断定を避けるため）。 */
function lowestConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  return levels.reduce((lowest, level) =>
    CONFIDENCE_ORDER[level] < CONFIDENCE_ORDER[lowest] ? level : lowest,
  );
}

export function buildAxes(metrics: MetricResult[], genre: GenreKey): AxisResult[] {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));

  return AXIS_KEYS.map((axisKey) => {
    const composition = AXIS_COMPOSITION[axisKey];
    const members = composition
      .map((metricKey) => byKey.get(metricKey))
      .filter((metric): metric is MetricResult => Boolean(metric));

    const score =
      members.length === 0
        ? 0
        : members.reduce((sum, metric) => sum + metric.normalizedScore, 0) / members.length;

    // 軸のパーセンタイルは、軸スコアを構成項目の分布の平均に照らして算出する
    const percentile =
      members.length === 0
        ? 0
        : members.reduce((sum, metric) => sum + metricPercentile(score, metric.key, genre), 0) /
          members.length;

    return {
      key: axisKey,
      score: Number(score.toFixed(1)),
      percentile: Number(percentile.toFixed(1)),
      confidence: members.length === 0 ? "LOW" : lowestConfidence(members.map((m) => m.confidence)),
      metrics: composition,
    };
  });
}
