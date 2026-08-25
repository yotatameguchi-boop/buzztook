/**
 * Percentile Service（仕様書 §8, §9）
 *
 * 正規化スコア（0-100）を比較母集団内のパーセンタイルに変換する。
 * 仕様書 §22-1 のとおり、スコアとパーセンタイルは明確に分離して扱う。
 *
 * Ver.1 は参照分布（平均・標準偏差）を持つ統計モデル。
 * TODO(Phase 5): 実際の分析結果の分布から母集団ごとのヒストグラムを構築して置き換える。
 */

import type { GenreKey, MetricKey, PopulationKey, PopulationResult } from "@/lib/domain/types";

interface Distribution {
  mean: number;
  sd: number;
  sampleSize: number;
}

/** 標準正規分布の累積分布関数（Abramowitz & Stegun 近似）。 */
function normalCdf(z: number): number {
  const t = 1 / (1 + 0.2316419 * Math.abs(z));
  const d = 0.3989423 * Math.exp(-(z * z) / 2);
  const probability = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return z > 0 ? 1 - probability : probability;
}

function toPercentile(score: number, distribution: Distribution): number {
  const z = (score - distribution.mean) / distribution.sd;
  const percentile = normalCdf(z) * 100;
  // 断定を避けるため両端は 1-99 に丸める
  return Number(Math.min(99, Math.max(1, percentile)).toFixed(1));
}

/**
 * 総合スコアの比較母集団（仕様書 §9）。
 * Ver.1 は想定分布。sampleSize は「この分布が何件相当の想定か」を示す表示用の値。
 */
const OVERALL_DISTRIBUTIONS: Record<Exclude<PopulationKey, "OWN_HISTORY">, Distribution> = {
  // TikTok 全体は玉石混交のためばらつきが大きい
  ALL: { mean: 44, sd: 17, sampleSize: 12000 },
  // 同ジャンルは型が似るため平均が上がり、ばらつきは小さい
  GENRE: { mean: 49, sd: 14, sampleSize: 2400 },
  // 同規模アカウントは制作体制が近いため中央に寄る
  SIMILAR_SCALE: { mean: 47, sd: 15, sampleSize: 1800 },
};

/** 項目ごとの参照分布。項目によって「そもそも取りにくい」ものがあるため平均を変えている。 */
const METRIC_DISTRIBUTIONS: Record<MetricKey, Distribution> = {
  hook: { mean: 46, sd: 17, sampleSize: 2400 },
  curiosity: { mean: 43, sd: 16, sampleSize: 2400 },
  targetFit: { mean: 48, sd: 16, sampleSize: 2400 },
  empathy: { mean: 41, sd: 17, sampleSize: 2400 },
  novelty: { mean: 52, sd: 14, sampleSize: 2400 },
  structure: { mean: 50, sd: 15, sampleSize: 2400 },
  informationDensity: { mean: 47, sd: 16, sampleSize: 2400 },
  emotion: { mean: 40, sd: 18, sampleSize: 2400 },
  virality: { mean: 38, sd: 17, sampleSize: 2400 },
  memorability: { mean: 36, sd: 16, sampleSize: 2400 },
};

/**
 * ジャンルごとの難易度シフト。同ジャンル内の競争が激しい項目は平均を上げる。
 * TODO(Phase 5): 実データのジャンル別分布に置き換える。
 */
const GENRE_SHIFT: Partial<Record<GenreKey, Partial<Record<MetricKey, number>>>> = {
  comedy: { emotion: +8, empathy: +5, informationDensity: -6 },
  education: { informationDensity: +6, structure: +5, emotion: -6 },
  howto: { informationDensity: +8, structure: +6, emotion: -8 },
  vlog: { empathy: +7, informationDensity: -8, structure: -4 },
  story: { curiosity: +7, empathy: +6, informationDensity: -8 },
  product: { targetFit: +6, virality: -3 },
  beauty: { targetFit: +5, memorability: +3 },
  food: { informationDensity: +4, memorability: +3 },
};

export function metricPercentile(score: number, metric: MetricKey, genre: GenreKey): number {
  const base = METRIC_DISTRIBUTIONS[metric];
  const shift = GENRE_SHIFT[genre]?.[metric] ?? 0;
  return toPercentile(score, { ...base, mean: base.mean + shift });
}

export interface OverallPercentileContext {
  genre: GenreKey;
  /** 同一アカウントの過去分析の総合スコア一覧（OWN_HISTORY 比較に使う） */
  ownHistoryScores: number[];
}

/** 比較母集団ごとのパーセンタイル（仕様書 §9）。 */
export function overallPercentiles(
  overallScore: number,
  context: OverallPercentileContext,
): PopulationResult[] {
  const results: PopulationResult[] = [
    {
      key: "ALL",
      percentile: toPercentile(overallScore, OVERALL_DISTRIBUTIONS.ALL),
      available: true,
      sampleSize: OVERALL_DISTRIBUTIONS.ALL.sampleSize,
    },
    {
      key: "GENRE",
      percentile: toPercentile(overallScore, OVERALL_DISTRIBUTIONS.GENRE),
      available: true,
      sampleSize: OVERALL_DISTRIBUTIONS.GENRE.sampleSize,
    },
    {
      key: "SIMILAR_SCALE",
      percentile: toPercentile(overallScore, OVERALL_DISTRIBUTIONS.SIMILAR_SCALE),
      available: true,
      sampleSize: OVERALL_DISTRIBUTIONS.SIMILAR_SCALE.sampleSize,
    },
  ];

  const history = context.ownHistoryScores;
  if (history.length >= 2) {
    const mean = history.reduce((sum, score) => sum + score, 0) / history.length;
    const variance = history.reduce((sum, score) => sum + (score - mean) ** 2, 0) / history.length;
    // 標本が少ないときに極端な値にならないよう、標準偏差に下限を置く
    const sd = Math.max(6, Math.sqrt(variance));
    results.push({
      key: "OWN_HISTORY",
      percentile: toPercentile(overallScore, { mean, sd, sampleSize: history.length }),
      available: true,
      sampleSize: history.length,
      note: `過去${history.length}件の分析（平均スコア ${mean.toFixed(1)}）との比較`,
    });
  } else {
    results.push({
      key: "OWN_HISTORY",
      percentile: 0,
      available: false,
      sampleSize: history.length,
      note: "同じアカウントで2件以上分析すると比較できます",
    });
  }

  return results;
}

/** 表示用：パーセンタイル 88 → 「上位12%」（仕様書 §16 の注意書き） */
export function toTopPercentText(percentile: number): string {
  const top = Math.max(1, Math.round(100 - percentile));
  return `上位${top}%`;
}
