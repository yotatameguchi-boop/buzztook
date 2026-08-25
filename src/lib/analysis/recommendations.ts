/**
 * Recommendation Service（仕様書 §13）
 *
 * 優先順位 = Impact（改善時の予測効果） × Confidence（予測の信頼度）。
 *
 * Impact はジャンル別重み（その項目がこのジャンルでどれだけ効くか）と
 * 現状スコアの伸びしろ（改善余地）から算出する。感覚値ではない。
 *
 * 仕様書 §22-2 に従い、evidence で DATA_INSIGHT / AI_SUGGESTION を明確に分ける。
 * - DATA_INSIGHT : 台本から抽出した特徴量と、その項目の参照分布に基づく指摘
 * - AI_SUGGESTION: 具体的な書き換え案など、生成側の提案
 */

import type {
  ConfidenceLevel,
  EvidenceType,
  GenreKey,
  ImpactLevel,
  Improvement,
  MetricKey,
  MetricResult,
} from "@/lib/domain/types";
import type { ScriptFeatures } from "./features";
import { GENRE_WEIGHTS } from "./scoring";

interface RuleCandidate {
  id: string;
  metric: MetricKey;
  title: string;
  detail: string;
  evidence: EvidenceType;
  evidenceNote?: string;
  /** ルール固有の効果係数（0-1）。同じ項目でも施策によって効き方が違うため。 */
  effect: number;
}

const IMPACT_VALUE: Record<ImpactLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const CONFIDENCE_VALUE: Record<ConfidenceLevel, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };

function collectCandidates(features: ScriptFeatures, genre: GenreKey): RuleCandidate[] {
  const candidates: RuleCandidate[] = [];
  const f = features;

  // --- フック力 ---
  if (f.hasSelfIntroInOpening) {
    candidates.push({
      id: "remove-self-intro",
      metric: "hook",
      title: "冒頭の自己紹介を削除する",
      detail:
        "冒頭の自己紹介・チャンネル紹介は、視聴者がまだ「見る理由」を持っていない段階で尺を消費します。1文目をいきなり本題または問題提起から始めてください。",
      evidence: "DATA_INSIGHT",
      evidenceNote: `冒頭 ${f.openingSeconds}秒に自己紹介表現を検出`,
      effect: 0.9,
    });
  }

  if (f.hookSignalTypes === 0) {
    candidates.push({
      id: "add-hook-signal",
      metric: "hook",
      title: "1文目に「質問・数字・警告」のいずれかを入れる",
      detail:
        "例：「◯◯してる人、実は損してます」「知らないと9割が失敗する◯◯を3つ話します」。断定と具体的な数字を組み合わせると冒頭の離脱が下がります。",
      evidence: "AI_SUGGESTION",
      effect: 1,
    });
  } else if (!f.hasNumberInOpening) {
    candidates.push({
      id: "add-number-in-opening",
      metric: "hook",
      title: "冒頭に具体的な数字を足す",
      detail:
        "「3つ」「9割」「30秒で」などの数値を冒頭に置くと、動画の全体像が伝わり視聴継続の判断がしやすくなります。",
      evidence: "AI_SUGGESTION",
      effect: 0.5,
    });
  }

  if (f.timeToPointSeconds > 8) {
    candidates.push({
      id: "shorten-time-to-point",
      metric: "hook",
      title: `本題を約${Math.max(2, Math.round(f.timeToPointSeconds - 4))}秒早く提示する`,
      detail: `現在は本題に入るまで約${f.timeToPointSeconds}秒かかっています。結論・ポイントを先出しし、理由や前提は後ろに回してください。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `本題マーカーの出現位置から推定：${f.timeToPointSeconds}秒`,
      effect: 0.8,
    });
  }

  // --- 好奇心維持力 ---
  if (f.newInfoIntervalSeconds > 12) {
    candidates.push({
      id: "increase-new-info",
      metric: "curiosity",
      title: "中盤に新情報の投入を増やす",
      detail: `新しい情報が出てくる間隔が約${f.newInfoIntervalSeconds}秒あります。6〜8秒に1回、視点の切り替えや追加情報を入れると中だるみを防げます。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `新情報を示す接続表現 ${f.newInfoCount}回／推定尺 ${f.estimatedDurationSeconds}秒`,
      effect: 0.8,
    });
  }

  if (f.foreshadowCount === 0) {
    candidates.push({
      id: "add-foreshadow",
      metric: "curiosity",
      title: "後半への引っ張りを1箇所入れる",
      detail: "「特に3つ目が重要です」「最後にひとつだけ注意点があります」のように、先の内容を予告すると完視聴率が上がります。",
      evidence: "AI_SUGGESTION",
      effect: 0.7,
    });
  }

  if (f.averageSentenceLength > 45) {
    candidates.push({
      id: "shorten-sentences",
      metric: "curiosity",
      title: "1文を短く割る",
      detail: `1文の平均が${f.averageSentenceLength}文字あります。25〜35文字程度に割ると、テンポが出て離脱しにくくなります。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `平均文長 ${f.averageSentenceLength}文字`,
      effect: 0.6,
    });
  }

  // --- ターゲット適合性 ---
  if (f.targetSpecificity < 0.45) {
    candidates.push({
      id: "sharpen-target",
      metric: "targetFit",
      title: "ターゲットを一段具体化する",
      detail:
        "「20代女性」ではなく「就職して1年目、朝のメイクに10分しかかけられない人」のように、状況と悩みまで指定すると台本の語彙も自然に噛み合います。",
      evidence: "DATA_INSIGHT",
      evidenceNote: `ターゲット記述の具体性スコア ${(f.targetSpecificity * 100).toFixed(0)}/100`,
      effect: 0.8,
    });
  }

  if (f.targetOverlapRatio < 0.3) {
    candidates.push({
      id: "mirror-target-words",
      metric: "targetFit",
      title: "ターゲットが使う言葉を台本に入れる",
      detail: `設定したターゲット像の語が台本にほとんど登場していません（重なり ${Math.round(f.targetOverlapRatio * 100)}%）。冒頭で「◯◯な人向けです」と名指しするだけでも適合性は上がります。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `ターゲット記述との語の重なり ${Math.round(f.targetOverlapRatio * 100)}%`,
      effect: 0.7,
    });
  }

  // --- 共感性 ---
  if (f.empathyCount === 0) {
    candidates.push({
      id: "add-empathy-line",
      metric: "empathy",
      title: "「あるある」を1行入れる",
      detail: "「これ、やりがちですよね」のように視聴者の行動を先回りして言語化すると、共感コメントが伸びやすくなります。",
      evidence: "AI_SUGGESTION",
      effect: 0.85,
    });
  }

  if (f.commentTriggerCount === 0) {
    candidates.push({
      id: "add-comment-trigger",
      metric: "empathy",
      title: "コメントを促す問いかけを最後に置く",
      detail: "「あなたはどっち派ですか？」など、二択の問いはコメント率が上がりやすい形式です。",
      evidence: "AI_SUGGESTION",
      effect: 0.7,
    });
  }

  // --- 新規性 ---
  if (f.maxSimilarity > 0.45) {
    candidates.push({
      id: "differentiate-angle",
      metric: "novelty",
      title: "定番の型からずらす",
      detail: `この台本は定番構成との類似度が${Math.round(f.maxSimilarity * 100)}%あります。切り口（逆張り・失敗談・比較・実測）を1つ足すと差別化できます。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `参照コンテンツとの最大類似度 ${Math.round(f.maxSimilarity * 100)}%`,
      effect: 0.75,
    });
  }

  // --- 構成力 ---
  if (!f.hasEnding) {
    candidates.push({
      id: "add-ending",
      metric: "structure",
      title: "締め・オチを明示する",
      detail: "最後が言い切りで終わっていません。まとめの1文か、次の行動（保存・試す）を示す1文で閉じてください。",
      evidence: "DATA_INSIGHT",
      evidenceNote: "終盤に締めのマーカーを検出できませんでした",
      effect: 0.8,
    });
  }

  if (f.listMarkerCount < 2 && (genre === "education" || genre === "howto")) {
    candidates.push({
      id: "add-list-structure",
      metric: "structure",
      title: "内容を番号付きで区切る",
      detail: "「1つ目」「2つ目」と区切ると、視聴者が現在地を把握でき、途中離脱が減ります。解説・ハウツー系では特に効果が出やすい構造です。",
      evidence: "DATA_INSIGHT",
      evidenceNote: `列挙マーカー ${f.listMarkerCount}箇所`,
      effect: 0.7,
    });
  }

  // --- 情報密度 ---
  if (f.durationRatio > 1.25) {
    candidates.push({
      id: "trim-script",
      metric: "informationDensity",
      title: "台本を想定尺に収める",
      detail: `台本の推定尺は${f.estimatedDurationSeconds}秒で、想定尺の${Math.round(f.durationRatio * 100)}%あります。前提説明を削るか、想定尺自体を見直してください。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `推定尺 ${f.estimatedDurationSeconds}秒 / 想定尺比 ${Math.round(f.durationRatio * 100)}%`,
      effect: 0.85,
    });
  } else if (f.durationRatio < 0.7) {
    candidates.push({
      id: "enrich-script",
      metric: "informationDensity",
      title: "内容を追加して尺を埋める",
      detail: `台本の推定尺は${f.estimatedDurationSeconds}秒で、想定尺に対して短すぎます。具体例か根拠を1つ追加してください。`,
      evidence: "DATA_INSIGHT",
      evidenceNote: `推定尺 ${f.estimatedDurationSeconds}秒 / 想定尺比 ${Math.round(f.durationRatio * 100)}%`,
      effect: 0.7,
    });
  }

  // --- 感情誘発力 ---
  if (f.emotionTypeCount <= 1) {
    candidates.push({
      id: "add-emotional-beat",
      metric: "emotion",
      title: "感情の起伏を1箇所作る",
      detail: "驚き・笑い・共感のいずれかを、山場にあたる位置で明確に立ててください。感情が動かない動画はシェアされにくくなります。",
      evidence: "AI_SUGGESTION",
      effect: 0.8,
    });
  }

  // --- 拡散力 ---
  if (f.shareTriggerCount === 0) {
    candidates.push({
      id: "add-share-trigger",
      metric: "virality",
      title: "「誰かに教えたくなる」一言を足す",
      detail: "「これ知らない友達に送ってあげてください」のような明示的な導線か、共有したくなる意外な事実を1つ入れてください。",
      evidence: "AI_SUGGESTION",
      effect: 0.85,
    });
  }

  // --- 記憶残存性 ---
  if (f.saveTriggerCount === 0 && f.memorabilityCount === 0) {
    candidates.push({
      id: "add-save-trigger",
      metric: "memorability",
      title: "保存する理由を作る",
      detail: "手順・チェックリスト・数値をまとめて提示すると「後で見返す」理由になり、保存率が上がります。",
      evidence: "AI_SUGGESTION",
      effect: 0.7,
    });
  }

  return candidates;
}

/**
 * 個別ルールに当てはまらなかった弱点項目のための汎用提案。
 * これがないと「スコアは低いのに提案が出ない」項目が生まれてしまう。
 */
const FALLBACK_SUGGESTIONS: Record<MetricKey, { title: string; detail: string }> = {
  hook: {
    title: "冒頭2秒をもう一段強くする",
    detail: "1文目だけを3パターン書き出し、最も具体的で、最も「自分ごと」に聞こえるものを選んでください。",
  },
  curiosity: {
    title: "中盤の展開に変化をつける",
    detail: "同じトーンが続くと離脱します。問いかけ・視点の切り替え・具体例のいずれかを中盤に差し込んでください。",
  },
  targetFit: {
    title: "冒頭でターゲットを名指しする",
    detail: "「◯◯で困っている人向けです」と冒頭で宣言すると、対象者の視聴維持率が上がり、対象外の離脱は問題になりません。",
  },
  empathy: {
    title: "視聴者の状況を先に言語化する",
    detail: "解決策の前に「こうなってませんか」と現状を描写すると、共感が生まれてからの話になります。",
  },
  novelty: {
    title: "自分だけが言える情報を足す",
    detail: "実測値・失敗談・具体的な数字など、他の人がコピーできない要素を1つ入れてください。",
  },
  structure: {
    title: "構成を5ブロックで組み直す",
    detail: "フック→前提→展開→山場→締め の順に並べ替え、どのブロックにも属さない文は削ってください。",
  },
  informationDensity: {
    title: "1文あたりの情報量を揃える",
    detail: "情報が詰まった箇所と薄い箇所の差が大きいと体感テンポが崩れます。薄い部分を削り、密な部分を分割してください。",
  },
  emotion: {
    title: "感情が動く瞬間を作る",
    detail: "驚き・笑い・共感のいずれかを、山場にあたる位置ではっきり立ててください。",
  },
  virality: {
    title: "共有する動機を用意する",
    detail: "「知らないと損する」「誰かに教えたくなる」情報を1つ含めると、シェア率が上がりやすくなります。",
  },
  memorability: {
    title: "持ち帰れる形にまとめる",
    detail: "3点にまとめる、チェックリストにする、など後から思い出せる形にすると保存・再訪につながります。",
  },
};

/**
 * Impact = ジャンル別重み × 伸びしろ × ルール固有の効果係数。
 * 「重要な項目が、低いスコアで、効く施策がある」ほど大きくなる。
 */
function resolveImpact(candidate: RuleCandidate, metric: MetricResult, genre: GenreKey): {
  level: ImpactLevel;
  value: number;
} {
  const weight = GENRE_WEIGHTS[genre][candidate.metric];
  const headroom = Math.max(0, 100 - metric.normalizedScore) / 100;
  // weight の最大は概ね 0.18。1.0 前後に正規化して比較しやすくする。
  const value = (weight / 0.18) * headroom * candidate.effect;
  const level: ImpactLevel = value >= 0.5 ? "HIGH" : value >= 0.28 ? "MEDIUM" : "LOW";
  return { level, value };
}

export function buildImprovements(
  features: ScriptFeatures,
  metrics: MetricResult[],
  genre: GenreKey,
): Improvement[] {
  const byKey = new Map(metrics.map((metric) => [metric.key, metric]));

  const candidates = collectCandidates(features, genre);
  const covered = new Set(candidates.map((candidate) => candidate.metric));

  // 明確に弱い（同ジャンル内で下位）のに個別ルールが当たらなかった項目を補う
  for (const metric of metrics) {
    if (covered.has(metric.key) || metric.percentile >= 35) continue;
    const fallback = FALLBACK_SUGGESTIONS[metric.key];
    candidates.push({
      id: `fallback-${metric.key}`,
      metric: metric.key,
      title: fallback.title,
      detail: fallback.detail,
      evidence: "AI_SUGGESTION",
      effect: 0.6,
    });
  }

  const improvements = candidates
    .map((candidate): Improvement | null => {
      const metric = byKey.get(candidate.metric);
      if (!metric) return null;
      const impact = resolveImpact(candidate, metric, genre);

      // 提案の信頼度は、対象項目のスコア信頼度を上限とする。
      // ただし AI 提案は「データ根拠がない」ため、1段下げる（仕様書 §22-2, §22-4）。
      const metricConfidence = metric.confidence;
      const confidence: ConfidenceLevel =
        candidate.evidence === "AI_SUGGESTION"
          ? metricConfidence === "HIGH"
            ? "MEDIUM"
            : "LOW"
          : metricConfidence;

      return {
        id: candidate.id,
        priority: IMPACT_VALUE[impact.level] * CONFIDENCE_VALUE[confidence] + impact.value,
        title: candidate.title,
        detail: candidate.detail,
        relatedMetric: candidate.metric,
        impact: impact.level,
        confidence,
        evidence: candidate.evidence,
        evidenceNote: candidate.evidenceNote,
      };
    })
    .filter((improvement): improvement is Improvement => improvement !== null)
    .sort((a, b) => b.priority - a.priority);

  // 上位のみ提示する（多すぎると優先順位の意味がなくなるため）
  return improvements.slice(0, 6);
}

/** 強み・弱みの抽出。パーセンタイル基準で判定する（仕様書 §21 Task 6）。 */
export function pickStrengthsAndWeaknesses(metrics: MetricResult[]): {
  strengths: MetricKey[];
  weaknesses: MetricKey[];
} {
  const sorted = [...metrics].sort((a, b) => b.percentile - a.percentile);
  const strengths = sorted.filter((metric) => metric.percentile >= 60).slice(0, 3);
  const weaknesses = [...sorted].reverse().filter((metric) => metric.percentile < 45).slice(0, 3);

  return {
    strengths: (strengths.length > 0 ? strengths : sorted.slice(0, 2)).map((metric) => metric.key),
    weaknesses: (weaknesses.length > 0 ? weaknesses : [...sorted].reverse().slice(0, 2)).map(
      (metric) => metric.key,
    ),
  };
}
