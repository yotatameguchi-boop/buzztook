/**
 * Scoring Service（仕様書 §17）
 *
 * 特徴量 → 10項目の生スコア（0-1）→ 補正 → 正規化スコア（0-100）。
 * パーセンタイル変換は percentile.ts の責務。ここでは行わない。
 *
 * Ver.1 はルール + 統計（仕様書 §17「最初はルール + 統計」）。
 * TODO(Phase 5): 投稿実績が蓄積したら LightGBM 等の表形式モデルに置き換える。
 *                そのとき差し替えるのはこのファイルだけで済むように、
 *                入力（ScriptFeatures）と出力（MetricComputation[]）を固定している。
 */

import type {
  ConfidenceLevel,
  GenreKey,
  MetricKey,
  MetricScores,
} from "@/lib/domain/types";
import { METRIC_KEYS } from "@/lib/domain/types";
import type { ScriptFeatures } from "./features";

/** ジャンル別の重み（仕様書 §11）。各ジャンルで合計 1.0 になるようにする。 */
export const GENRE_WEIGHTS: Record<GenreKey, MetricScores> = {
  education: {
    hook: 0.16,
    curiosity: 0.12,
    targetFit: 0.14,
    empathy: 0.06,
    novelty: 0.08,
    structure: 0.15,
    informationDensity: 0.14,
    emotion: 0.04,
    virality: 0.07,
    memorability: 0.04,
  },
  comedy: {
    hook: 0.16,
    curiosity: 0.12,
    targetFit: 0.06,
    empathy: 0.12,
    novelty: 0.1,
    structure: 0.09,
    informationDensity: 0.05,
    emotion: 0.18,
    virality: 0.09,
    memorability: 0.03,
  },
  vlog: {
    hook: 0.13,
    curiosity: 0.14,
    targetFit: 0.09,
    empathy: 0.18,
    novelty: 0.08,
    structure: 0.14,
    informationDensity: 0.06,
    emotion: 0.09,
    virality: 0.06,
    memorability: 0.03,
  },
  product: {
    hook: 0.17,
    curiosity: 0.1,
    targetFit: 0.18,
    empathy: 0.08,
    novelty: 0.07,
    structure: 0.11,
    informationDensity: 0.11,
    emotion: 0.05,
    virality: 0.08,
    memorability: 0.05,
  },
  beauty: {
    hook: 0.15,
    curiosity: 0.11,
    targetFit: 0.16,
    empathy: 0.1,
    novelty: 0.08,
    structure: 0.1,
    informationDensity: 0.11,
    emotion: 0.05,
    virality: 0.08,
    memorability: 0.06,
  },
  food: {
    hook: 0.14,
    curiosity: 0.12,
    targetFit: 0.1,
    empathy: 0.08,
    novelty: 0.09,
    structure: 0.12,
    informationDensity: 0.12,
    emotion: 0.08,
    virality: 0.09,
    memorability: 0.06,
  },
  howto: {
    hook: 0.15,
    curiosity: 0.11,
    targetFit: 0.13,
    empathy: 0.06,
    novelty: 0.08,
    structure: 0.14,
    informationDensity: 0.15,
    emotion: 0.04,
    virality: 0.08,
    memorability: 0.06,
  },
  story: {
    hook: 0.16,
    curiosity: 0.18,
    targetFit: 0.08,
    empathy: 0.15,
    novelty: 0.1,
    structure: 0.14,
    informationDensity: 0.04,
    emotion: 0.11,
    virality: 0.03,
    memorability: 0.01,
  },
};

/**
 * ジャンル別の最適な情報密度（30秒あたりの意味単位数）。仕様書 §7-7。
 * 「多いほど高得点」ではなく、ジャンルごとの最適帯からの距離で評価する。
 * TODO(Phase 5): 実績データからジャンルごとの最適帯を学習する。
 */
const GENRE_OPTIMAL_DENSITY: Record<GenreKey, number> = {
  education: 12,
  comedy: 9,
  vlog: 7,
  product: 10,
  beauty: 10,
  food: 11,
  howto: 13,
  story: 8,
};

/**
 * ジャンル補正の基準値（仕様書 §8 のジャンル補正）。
 * そのジャンルの台本が「自然に取りやすいスコア」。高いジャンルほど同じ生スコアの価値を下げる。
 */
const GENRE_BASELINE: Partial<Record<GenreKey, Partial<MetricScores>>> = {
  comedy: { emotion: 62, empathy: 58, informationDensity: 42 },
  vlog: { empathy: 60, informationDensity: 40, structure: 45 },
  education: { informationDensity: 58, structure: 56, emotion: 40 },
  howto: { informationDensity: 60, structure: 58, emotion: 38 },
  story: { curiosity: 58, empathy: 58, informationDensity: 40 },
  product: { targetFit: 56 },
  beauty: { targetFit: 55 },
  food: { informationDensity: 54 },
};

const DEFAULT_BASELINE = 50;

export interface ScoringContext {
  genre: GenreKey;
  expectedDuration: number;
  /** 投稿予定アカウントのフォロワー数。未連携なら undefined。 */
  followerCount?: number;
  /** 同一アカウントの過去分析件数。信頼度と OWN_HISTORY 比較に使う。 */
  ownHistoryCount: number;
}

export interface MetricComputation {
  key: MetricKey;
  rawScore: number;
  normalizedScore: number;
  confidence: ConfidenceLevel;
  notes: string[];
}

// --- 補助関数 ---------------------------------------------------------------

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** lo 以下で 0、hi 以上で 1 になる線形ランプ。 */
const ramp = (value: number, lo: number, hi: number) => clamp01((value - lo) / (hi - lo));

/** lo 以下で 1、hi 以上で 0 になる逆ランプ（小さいほど良い指標に使う）。 */
const inverseRamp = (value: number, lo: number, hi: number) => 1 - ramp(value, lo, hi);

/** optimum を頂点とする山型。最適帯から離れるほど下がる。 */
const band = (value: number, optimum: number, tolerance: number) =>
  clamp01(Math.exp(-Math.pow((value - optimum) / tolerance, 2)));

/** 出現回数を「尺あたりの密度」に直したうえで 0-1 に収める。 */
const density = (count: number, seconds: number, per30sSaturation: number) => {
  if (seconds <= 0) return 0;
  const per30 = (count / seconds) * 30;
  return clamp01(per30 / per30sSaturation);
};

// --- 10項目の生スコア -------------------------------------------------------

type RawResult = { raw: number; notes: string[] };

/** 1. フック力（仕様書 §7-1） */
function scoreHook(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const signals = clamp01(f.hookSignalTypes / 3);
  if (f.hookSignalTypes === 0) notes.push("冒頭にフック要素（質問・警告・数字・意外性）が検出されませんでした");
  else notes.push(`冒頭のフック要素：${f.hookSignalTypes}種類`);

  const brevity = inverseRamp(f.openingCharCount, 20, 60);
  if (f.openingCharCount > 45) notes.push(`冒頭の1文が長め（${f.openingCharCount}文字 ≒ ${f.openingSeconds}秒）`);

  const quickPoint = inverseRamp(f.timeToPointSeconds, 3, 15);
  notes.push(`本題に入るまで約${f.timeToPointSeconds}秒`);

  const numberBonus = f.hasNumberInOpening ? 0.08 : 0;
  if (f.hasNumberInOpening) notes.push("冒頭に数字があり具体性が高い");

  const secondPerson = f.hookSignals.secondPerson > 0 ? 0.06 : 0;
  const selfIntroPenalty = f.hasSelfIntroInOpening ? 0.22 : 0;
  if (f.hasSelfIntroInOpening) notes.push("冒頭に自己紹介・チャンネル紹介が含まれています");

  const raw =
    signals * 0.42 + brevity * 0.16 + quickPoint * 0.2 + numberBonus + secondPerson - selfIntroPenalty + 0.14;
  return { raw: clamp01(raw), notes };
}

/** 2. 好奇心維持力（仕様書 §7-2） */
function scoreCuriosity(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const pacing = band(f.newInfoIntervalSeconds, 6, 8);
  notes.push(
    f.newInfoCount === 0
      ? "新情報の投入を示す接続表現がありません"
      : `新情報の投入は約${f.newInfoIntervalSeconds}秒間隔（${f.newInfoCount}回）`,
  );

  const foreshadow = clamp01(f.foreshadowCount / 2);
  if (f.foreshadowCount > 0) notes.push(`伏線・引っ張り表現：${f.foreshadowCount}箇所`);
  else notes.push("「最後に」「この後」などの引っ張り表現がありません");

  const gap = clamp01(f.gapCount / 2);
  const list = clamp01(f.listMarkerCount / 3);
  const question = clamp01(f.questionCount / 3);
  const sentenceLength = inverseRamp(f.averageSentenceLength, 30, 70);
  if (f.averageSentenceLength > 40) notes.push(`1文が長い（平均${f.averageSentenceLength}文字）ため中だるみしやすい`);

  const raw = pacing * 0.3 + foreshadow * 0.17 + gap * 0.13 + list * 0.15 + question * 0.1 + sentenceLength * 0.15;
  return { raw: clamp01(raw), notes };
}

/** 3. ターゲット適合性（仕様書 §7-3） */
function scoreTargetFit(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const specificity = f.targetSpecificity;
  if (specificity < 0.4) notes.push("ターゲット設定が抽象的です（年代・状況・悩みを具体化すると精度が上がります）");
  else notes.push("ターゲット設定は具体的です");

  const overlap = f.targetOverlapRatio;
  notes.push(`ターゲット記述と台本の語の重なり：${Math.round(overlap * 100)}%`);

  const vocabulary = clamp01(f.genreVocabularyHits / 5);
  notes.push(`ジャンル頻出語のヒット：${f.genreVocabularyHits}件`);

  const address = f.hookSignals.secondPerson > 0 ? 1 : 0;

  const raw = specificity * 0.33 + overlap * 0.3 + vocabulary * 0.25 + address * 0.12;
  return { raw: clamp01(raw), notes };
}

/** 4. 共感性（仕様書 §7-4） */
function scoreEmpathy(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const empathyDensity = density(f.empathyCount, f.estimatedDurationSeconds, 3);
  notes.push(
    f.empathyCount === 0
      ? "「わかる」「あるある」を誘発する表現が見つかりません"
      : `共感表現：${f.empathyCount}箇所`,
  );

  const emotionEmpathy = clamp01((f.emotionCounts.empathy ?? 0) / 2);
  const commentTrigger = clamp01(f.commentTriggerCount / 2);
  if (f.commentTriggerCount > 0) notes.push("コメントを促す問いかけがあります（コメント率に効きます）");

  const raw = empathyDensity * 0.42 + emotionEmpathy * 0.18 + commentTrigger * 0.18 + f.targetSpecificity * 0.22;
  return { raw: clamp01(raw), notes };
}

/** 5. 新規性（仕様書 §7-5） */
function scoreNovelty(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const dissimilarity = clamp01(1 - f.maxSimilarity);
  notes.push(
    `参照コンテンツとの最大類似度：${Math.round(f.maxSimilarity * 100)}%${
      f.mostSimilarGenre ? `（最も近い型：${f.mostSimilarGenre}）` : ""
    }`,
  );

  const diversity = ramp(f.lexicalDiversity, 0.55, 0.9);
  const concreteness = f.hasNumberInOpening ? 1 : 0.5;

  // 「珍しいだけ」では評価しない（仕様書 §7-5）。
  // 構成が破綻している台本の新規性は割り引く。
  const structuralSupport = f.hasEnding && f.hasPeak ? 1 : 0.85;
  if (structuralSupport < 1) notes.push("独自性はあるが、山場または締めが弱いため評価を割り引いています");

  const raw = (dissimilarity * 0.6 + diversity * 0.25 + concreteness * 0.15) * structuralSupport;
  return { raw: clamp01(raw), notes };
}

/** 6. 構成力（仕様書 §7-6） */
function scoreStructure(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const present = [f.hasHook, f.hasContext, f.hasDevelopment, f.hasPeak, f.hasEnding].filter(Boolean).length;
  notes.push(`HOOK/CONTEXT/DEVELOPMENT/PEAK/ENDING のうち ${present}/5 を検出`);
  if (!f.hasEnding) notes.push("締め・オチが明確ではありません");

  const completeness = present / 5;
  const quickPoint = inverseRamp(f.timeToPointSeconds, 4, 18);
  const endingPosition = ramp(f.endingPositionRatio, 0.6, 0.85);
  const development = clamp01(f.listMarkerCount / 3);
  const concision = inverseRamp(f.averageSentenceLength, 28, 65);

  const raw = completeness * 0.38 + quickPoint * 0.2 + endingPosition * 0.14 + development * 0.16 + concision * 0.12;
  return { raw: clamp01(raw), notes };
}

/** 7. 情報密度（仕様書 §7-7） */
function scoreInformationDensity(f: ScriptFeatures, genre: GenreKey): RawResult {
  const notes: string[] = [];
  const optimum = GENRE_OPTIMAL_DENSITY[genre];
  const fit = band(f.unitsPer30Seconds, optimum, optimum * 0.45);
  notes.push(`30秒あたりの情報量：${f.unitsPer30Seconds}単位（このジャンルの最適帯：約${optimum}）`);
  if (f.unitsPer30Seconds > optimum * 1.5) notes.push("情報を詰め込みすぎている可能性があります");
  if (f.unitsPer30Seconds < optimum * 0.6) notes.push("尺に対して情報量が不足しています");

  const durationFit = band(f.durationRatio, 1, 0.35);
  notes.push(
    `台本の推定尺 ${f.estimatedDurationSeconds}秒（想定尺比 ${Math.round(f.durationRatio * 100)}%）`,
  );

  const newInfo = clamp01(f.newInfoCount / 4);

  const raw = fit * 0.55 + durationFit * 0.28 + newInfo * 0.17;
  return { raw: clamp01(raw), notes };
}

/** 8. 感情誘発力（仕様書 §7-8） */
function scoreEmotion(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const totalEmotion = Object.values(f.emotionCounts).reduce((sum, n) => sum + n, 0);
  const variety = clamp01(f.emotionTypeCount / 3);
  const intensity = density(totalEmotion, f.estimatedDurationSeconds, 5);
  const surprise = clamp01(((f.emotionCounts.surprise ?? 0) + f.gapCount) / 3);

  notes.push(
    totalEmotion === 0
      ? "感情を動かす表現が検出されませんでした"
      : `感情表現：${totalEmotion}箇所／${f.emotionTypeCount}種類`,
  );

  const raw = variety * 0.38 + intensity * 0.37 + surprise * 0.25;
  return { raw: clamp01(raw), notes };
}

/**
 * 9. 拡散力（仕様書 §7-9）
 * 実績側の virality_score_raw = share_rate*0.50 + comment_rate*0.30 + like_rate*0.20 に対応する
 * 台本側の代理指標を、同じ重みで構成する。
 */
export const VIRALITY_WEIGHTS = { share: 0.5, comment: 0.3, like: 0.2 } as const;

function scoreVirality(f: ScriptFeatures): RawResult {
  const notes: string[] = [];
  const shareProxy = clamp01((f.shareTriggerCount + f.saveTriggerCount * 0.5) / 2);
  const commentProxy = clamp01((f.commentTriggerCount + f.questionCount * 0.4) / 2.5);
  // いいねは「共感 + 感情」の強さを代理指標にする
  const likeProxy = clamp01((f.empathyCount + Object.values(f.emotionCounts).reduce((s, n) => s + n, 0)) / 6);

  if (f.shareTriggerCount === 0) notes.push("シェアを促す要素（誰かに教えたくなる構造）がありません");
  if (f.commentTriggerCount > 0) notes.push("コメント誘発の呼びかけがあります");

  const raw =
    shareProxy * VIRALITY_WEIGHTS.share + commentProxy * VIRALITY_WEIGHTS.comment + likeProxy * VIRALITY_WEIGHTS.like;
  notes.push("Ver.1 の重み：シェア 0.50 / コメント 0.30 / いいね 0.20（実績データ蓄積後に再学習）");
  return { raw: clamp01(raw), notes };
}

/** 10. 記憶残存性（仕様書 §7-10：Ver.1 は代理指標。信頼度は常に LOW） */
function scoreMemorability(f: ScriptFeatures, noveltyRaw: number): RawResult {
  const notes: string[] = [];
  const saveProxy = clamp01((f.saveTriggerCount + f.memorabilityCount) / 3);
  const seriesProxy = clamp01(f.followTriggerCount / 2);

  notes.push("Ver.1 では直接測定できないため、保存誘発・シリーズ性・独自性からの代理指標で算出しています");
  if (f.saveTriggerCount === 0) notes.push("保存・見返しを促す要素がありません");

  const raw = saveProxy * 0.5 + seriesProxy * 0.2 + noveltyRaw * 0.3;
  return { raw: clamp01(raw), notes };
}

// --- 補正 -------------------------------------------------------------------

/**
 * 仕様書 §8 のスコアリングパイプライン：
 * 生スコア → ジャンル補正 → アカウント規模補正 → 時期補正 → （percentile.ts でパーセンタイル変換）
 */
function applyCorrections(rawScore: number, metric: MetricKey, context: ScoringContext): number {
  const base = rawScore * 100;

  // ジャンル補正：そのジャンルで取りやすい項目は、同じ生スコアの価値を下げる
  const baseline = GENRE_BASELINE[context.genre]?.[metric] ?? DEFAULT_BASELINE;
  const genreFactor = Math.min(1.2, Math.max(0.82, DEFAULT_BASELINE / baseline));

  // アカウント規模補正：フォロワーが多いほど期待値が上がるため要求水準を上げる（仕様書 §6）
  const followers = context.followerCount ?? 0;
  const scaleFactor =
    followers > 0 ? Math.min(1.05, Math.max(0.92, 1 - 0.03 * Math.log10(Math.max(followers, 100) / 1000))) : 1;

  // 時期補正：Ver.1 では投稿時期データを持たないため 1.0 固定。
  // TODO(Phase 4): 投稿予定日時・季節性・ジャンルのトレンド指数から算出する。
  const seasonFactor = 1;

  return Math.min(100, Math.max(0, base * genreFactor * scaleFactor * seasonFactor));
}

/**
 * 項目ごとの信頼度（仕様書 §22-4）。
 * Ver.1 は「台本の情報量」と「モデルの成熟度」で決める。
 */
function resolveConfidence(metric: MetricKey, features: ScriptFeatures, context: ScoringContext): ConfidenceLevel {
  // 台本が短すぎると、どの項目も推定が不安定になる
  if (features.charCount < 60) return "LOW";

  // Ver.1 で代理指標に頼っている項目は信頼度を下げる（仕様書 §7-10, §18）
  if (metric === "memorability") return "LOW";
  if (metric === "novelty") {
    // 参照コーパスが小規模なため、実データが溜まるまでは MEDIUM 止まり
    return context.ownHistoryCount >= 5 ? "MEDIUM" : "LOW";
  }
  if (metric === "empathy" || metric === "emotion" || metric === "virality") {
    // 実績（コメント・シェア）が取れていない段階では台本側の代理指標のみ
    return context.ownHistoryCount >= 3 ? "MEDIUM" : "LOW";
  }

  // 構造・密度・フックは台本のみで比較的安定して測れる
  if (features.charCount >= 200) return "HIGH";
  return "MEDIUM";
}

// --- エントリポイント -------------------------------------------------------

export function computeMetrics(features: ScriptFeatures, context: ScoringContext): MetricComputation[] {
  const novelty = scoreNovelty(features);

  const rawResults: Record<MetricKey, RawResult> = {
    hook: scoreHook(features),
    curiosity: scoreCuriosity(features),
    targetFit: scoreTargetFit(features),
    empathy: scoreEmpathy(features),
    novelty,
    structure: scoreStructure(features),
    informationDensity: scoreInformationDensity(features, context.genre),
    emotion: scoreEmotion(features),
    virality: scoreVirality(features),
    memorability: scoreMemorability(features, novelty.raw),
  };

  return METRIC_KEYS.map((key) => {
    const { raw, notes } = rawResults[key];
    return {
      key,
      rawScore: Number(raw.toFixed(4)),
      normalizedScore: Number(applyCorrections(raw, key, context).toFixed(1)),
      confidence: resolveConfidence(key, features, context),
      notes,
    };
  });
}

/**
 * 総合スコア（仕様書 §11）。単純平均ではなくジャンル別重み付き和。
 * final_score = Σ(各10項目スコア × ジャンル別weight)
 */
export function computeOverallScore(scores: MetricScores, genre: GenreKey): number {
  const weights = GENRE_WEIGHTS[genre];
  const total = METRIC_KEYS.reduce((sum, key) => sum + scores[key] * weights[key], 0);
  return Number(total.toFixed(1));
}
