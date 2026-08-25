/**
 * BuzzTook ドメイン型定義
 * 仕様書 §7（10項目評価）／§10（表示5軸）／§15（DB設計）に対応。
 */

/** 内部評価の10項目（仕様書 §7）。UI には直接出さず、5軸に集約して表示する。 */
export const METRIC_KEYS = [
  "hook",
  "curiosity",
  "targetFit",
  "empathy",
  "novelty",
  "structure",
  "informationDensity",
  "emotion",
  "virality",
  "memorability",
] as const;

export type MetricKey = (typeof METRIC_KEYS)[number];

export const METRIC_LABELS: Record<MetricKey, string> = {
  hook: "フック力",
  curiosity: "好奇心維持力",
  targetFit: "ターゲット適合性",
  empathy: "共感性",
  novelty: "新規性",
  structure: "構成力",
  informationDensity: "情報密度",
  emotion: "感情誘発力",
  virality: "拡散力",
  memorability: "記憶残存性",
};

export const METRIC_DESCRIPTIONS: Record<MetricKey, string> = {
  hook: "最初の数秒で視聴者を止める力",
  curiosity: "「続きを見たい」と思わせ続ける力",
  targetFit: "対象者が明確で、その層に刺さる構造か",
  empathy: "「わかる」「私も」を引き出す力",
  novelty: "既存コンテンツとの差分",
  structure: "HOOK→CONTEXT→DEVELOPMENT→PEAK→ENDING の構造適合度",
  informationDensity: "尺に対する意味のある情報・変化の量",
  emotion: "驚き・笑い・感動などの感情反応を引き出す力",
  virality: "シェア・いいね・コメントにつながる力",
  memorability: "記憶に残り、後から見返される力",
};

/** ユーザー表示用の5軸（仕様書 §10）。 */
export const AXIS_KEYS = [
  "attraction",
  "resonance",
  "originality",
  "structure",
  "spread",
] as const;

export type AxisKey = (typeof AXIS_KEYS)[number];

export const AXIS_LABELS: Record<AxisKey, string> = {
  attraction: "引き込み",
  resonance: "刺さり",
  originality: "独自性",
  structure: "構成力",
  spread: "拡散力",
};

/** 5軸 → 構成する10項目（仕様書 §10）。重みは Ver.1 では均等。 */
export const AXIS_COMPOSITION: Record<AxisKey, MetricKey[]> = {
  attraction: ["hook", "curiosity"],
  resonance: ["targetFit", "empathy"],
  originality: ["novelty", "emotion"],
  structure: ["structure", "informationDensity"],
  spread: ["virality", "memorability"],
};

/** 信頼度（仕様書 §22-4）。データが少ない場合に断定しないための表示。 */
export type ConfidenceLevel = "HIGH" | "MEDIUM" | "LOW";

export const CONFIDENCE_LABELS: Record<ConfidenceLevel, string> = {
  HIGH: "高",
  MEDIUM: "中",
  LOW: "低",
};

/** 比較母集団（仕様書 §9）。 */
export const POPULATION_KEYS = [
  "ALL",
  "GENRE",
  "SIMILAR_SCALE",
  "OWN_HISTORY",
] as const;

export type PopulationKey = (typeof POPULATION_KEYS)[number];

export const POPULATION_LABELS: Record<PopulationKey, string> = {
  ALL: "TikTok全体",
  GENRE: "同ジャンル",
  SIMILAR_SCALE: "同規模アカウント",
  OWN_HISTORY: "自分の過去投稿",
  // TODO(Phase 4): 事務所・チーム内データ（TEAM）を比較母集団に追加する。
};

/** プロジェクトのステータス（仕様書 §15 projects.status）。 */
export const PROJECT_STATUSES = [
  "DRAFT",
  "SCRIPT_ANALYZED",
  "VIDEO_UPLOADED",
  "VIDEO_ANALYZED",
  "POSTED",
  "RESULT_COLLECTED",
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  DRAFT: "下書き",
  SCRIPT_ANALYZED: "台本分析済み",
  VIDEO_UPLOADED: "動画アップロード済み",
  VIDEO_ANALYZED: "動画分析済み",
  POSTED: "投稿済み",
  RESULT_COLLECTED: "実績取得済み",
};

/** ジャンル（仕様書 §11 のジャンル別重みと 1:1 で対応させる）。 */
export const GENRE_KEYS = [
  "education",
  "comedy",
  "vlog",
  "product",
  "beauty",
  "food",
  "howto",
  "story",
] as const;

export type GenreKey = (typeof GENRE_KEYS)[number];

export const GENRE_LABELS: Record<GenreKey, string> = {
  education: "教育・解説",
  comedy: "お笑い・ネタ",
  vlog: "Vlog・日常",
  product: "商品紹介・PR",
  beauty: "美容・コスメ",
  food: "グルメ・料理",
  howto: "ハウツー・ライフハック",
  story: "ストーリー・体験談",
};

export function isGenreKey(value: string): value is GenreKey {
  return (GENRE_KEYS as readonly string[]).includes(value);
}

/** 改善提案の根拠種別（仕様書 §13／§22-2：AI提案とデータ根拠を分離する）。 */
export type EvidenceType = "DATA_INSIGHT" | "AI_SUGGESTION";

export type ImpactLevel = "HIGH" | "MEDIUM" | "LOW";

export const IMPACT_LABELS: Record<ImpactLevel, string> = {
  HIGH: "大",
  MEDIUM: "中",
  LOW: "小",
};

export interface Improvement {
  id: string;
  /** 優先度 = Impact × Confidence（仕様書 §13） */
  priority: number;
  title: string;
  detail: string;
  /** この提案が主に効く評価項目 */
  relatedMetric: MetricKey;
  impact: ImpactLevel;
  confidence: ConfidenceLevel;
  evidence: EvidenceType;
  /** データ根拠の説明（DATA_INSIGHT のときのみ） */
  evidenceNote?: string;
}

export type MetricScores = Record<MetricKey, number>;
export type AxisScores = Record<AxisKey, number>;

export interface MetricResult {
  key: MetricKey;
  /** 特徴量から直接算出した生スコア（0-1、モデル差し替え時の比較用に保持） */
  rawScore: number;
  /** 補正後の正規化スコア（0-100） */
  normalizedScore: number;
  /** 比較母集団内でのパーセンタイル（0-100、高いほど上位） */
  percentile: number;
  confidence: ConfidenceLevel;
  /** スコアの根拠になった特徴量の要約 */
  notes: string[];
}

export interface AxisResult {
  key: AxisKey;
  score: number;
  percentile: number;
  confidence: ConfidenceLevel;
  metrics: MetricKey[];
}

export interface PopulationResult {
  key: PopulationKey;
  percentile: number;
  /** 比較対象が存在しない場合（例：過去投稿ゼロ）は false */
  available: boolean;
  /** 母集団サイズ（Ver.1 は参照分布の想定サンプル数） */
  sampleSize: number;
  note?: string;
}

export interface StructureSegment {
  key: "HOOK" | "CONTEXT" | "DEVELOPMENT" | "PEAK" | "ENDING";
  label: string;
  text: string;
  startRatio: number;
  endRatio: number;
  estimatedStartSeconds: number;
}

/** 台本分析の完全な結果。DB には payload として JSON 保存する。 */
export interface ScriptAnalysisResult {
  overallScore: number;
  /** overall_percentile = 88 は「上位12%」を意味する（仕様書 §16 の注意書き） */
  overallPercentile: number;
  overallConfidence: ConfidenceLevel;
  scores: MetricScores;
  metrics: MetricResult[];
  axes: AxisResult[];
  populations: PopulationResult[];
  segments: StructureSegment[];
  strengths: MetricKey[];
  weaknesses: MetricKey[];
  improvements: Improvement[];
  features: Record<string, number | string | boolean>;
  modelVersion: string;
  scoringVersion: string;
}
