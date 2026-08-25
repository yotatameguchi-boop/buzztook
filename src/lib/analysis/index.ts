/**
 * Script Analysis Service（仕様書 §17）のエントリポイント。
 *
 * 呼び出し側（API Route / UI）はこのファイルの ScriptAnalyzer インターフェースだけを見る。
 * 将来 Python(FastAPI) の分析サービスや LLM ベースの実装に差し替えるときは、
 * getScriptAnalyzer() が返す実装を替えるだけで済む（仕様書 §24「差し替え可能なサービス層に分離」）。
 */

import type {
  MetricResult,
  MetricScores,
  ScriptAnalysisResult,
  ConfidenceLevel,
} from "@/lib/domain/types";
import { METRIC_KEYS } from "@/lib/domain/types";
import { buildAxes } from "./axes";
import { extractFeatures, type ScriptFeatures, type ScriptInput } from "./features";
import { metricPercentile, overallPercentiles } from "./percentile";
import { buildImprovements, pickStrengthsAndWeaknesses } from "./recommendations";
import { computeMetrics, computeOverallScore } from "./scoring";
import { MODEL_VERSION, SCORING_VERSION } from "./version";

export type { ScriptInput, ScriptFeatures };

export interface AnalyzerContext {
  /** 投稿予定アカウントのフォロワー数（未連携なら undefined） */
  followerCount?: number;
  /** 同一アカウントの過去分析の総合スコア（OWN_HISTORY 比較・信頼度に使う） */
  ownHistoryScores: number[];
}

export interface ScriptAnalyzer {
  readonly modelVersion: string;
  readonly scoringVersion: string;
  analyze(input: ScriptInput, context: AnalyzerContext): Promise<ScriptAnalysisResult>;
}

const CONFIDENCE_ORDER: Record<ConfidenceLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/** 総合信頼度は、ジャンル重みが大きい項目の信頼度を重く見た加重平均で決める。 */
function resolveOverallConfidence(metrics: MetricResult[]): ConfidenceLevel {
  const average =
    metrics.reduce((sum, metric) => sum + CONFIDENCE_ORDER[metric.confidence], 0) / metrics.length;
  if (average >= 1.6) return "HIGH";
  if (average >= 0.9) return "MEDIUM";
  return "LOW";
}

/** payload に保存するため、特徴量をフラットなプリミティブに落とす。 */
function flattenFeatures(features: ScriptFeatures): Record<string, number | string | boolean> {
  const { segments, hookSignals, emotionCounts, ...rest } = features;
  const flat: Record<string, number | string | boolean> = { ...rest };
  for (const [key, value] of Object.entries(hookSignals)) flat[`hookSignal_${key}`] = value;
  for (const [key, value] of Object.entries(emotionCounts)) flat[`emotion_${key}`] = value;
  flat.segmentCount = segments.length;
  return flat;
}

/**
 * Ver.1 のルールベース実装（仕様書 §18「MVPでは簡易化」）。
 * 乱数を使わないため、同じ台本は常に同じ結果になる（再現性を担保）。
 */
export class RuleBasedScriptAnalyzer implements ScriptAnalyzer {
  readonly modelVersion = MODEL_VERSION;
  readonly scoringVersion = SCORING_VERSION;

  async analyze(input: ScriptInput, context: AnalyzerContext): Promise<ScriptAnalysisResult> {
    // 1. 特徴量抽出
    const features = extractFeatures(input);

    // 2. 生スコア → ジャンル／規模／時期補正 → 正規化スコア
    const computations = computeMetrics(features, {
      genre: input.genre,
      expectedDuration: input.expectedDuration,
      followerCount: context.followerCount,
      ownHistoryCount: context.ownHistoryScores.length,
    });

    // 3. パーセンタイル変換（比較母集団：同ジャンル）
    const metrics: MetricResult[] = computations.map((computation) => ({
      key: computation.key,
      rawScore: computation.rawScore,
      normalizedScore: computation.normalizedScore,
      percentile: metricPercentile(computation.normalizedScore, computation.key, input.genre),
      confidence: computation.confidence,
      notes: computation.notes,
    }));

    const scores = Object.fromEntries(
      metrics.map((metric) => [metric.key, metric.normalizedScore]),
    ) as MetricScores;

    // 4. 総合スコア（ジャンル別重み付き和）と比較母集団別パーセンタイル
    const overallScore = computeOverallScore(scores, input.genre);
    const populations = overallPercentiles(overallScore, {
      genre: input.genre,
      ownHistoryScores: context.ownHistoryScores,
    });
    // 主表示は「同ジャンル」内での位置
    const genrePercentile = populations.find((population) => population.key === "GENRE");

    // 5. 表示用5軸への集約と改善提案
    const axes = buildAxes(metrics, input.genre);
    const { strengths, weaknesses } = pickStrengthsAndWeaknesses(metrics);
    const improvements = buildImprovements(features, metrics, input.genre);

    return {
      overallScore,
      overallPercentile: genrePercentile?.percentile ?? 50,
      overallConfidence: resolveOverallConfidence(metrics),
      scores,
      metrics,
      axes,
      populations,
      segments: features.segments,
      strengths,
      weaknesses,
      improvements,
      features: flattenFeatures(features),
      modelVersion: this.modelVersion,
      scoringVersion: this.scoringVersion,
    };
  }
}

/**
 * 使用する分析実装を返す。
 *
 * TODO(Phase 2): ANALYSIS_SERVICE_URL が設定されていれば、
 *   FastAPI 側の Script Analysis Service を呼ぶ HttpScriptAnalyzer を返すようにする。
 * TODO(Phase 2): LLM による構造抽出を併用する LlmScriptAnalyzer を追加する。
 */
export function getScriptAnalyzer(): ScriptAnalyzer {
  return new RuleBasedScriptAnalyzer();
}

export { METRIC_KEYS };
