/**
 * Feature Extraction Service（仕様書 §17）
 *
 * 台本テキスト＋投稿条件から、スコアリングに使う特徴量を抽出する。
 * ここでは「スコア」は一切作らない。特徴量だけを返す（責務分離）。
 */

import type { GenreKey, StructureSegment } from "@/lib/domain/types";
import {
  CURIOSITY_PATTERNS,
  EMOTION_PATTERNS,
  EMPATHY_PATTERNS,
  ENDING_MARKERS,
  GENRE_VOCABULARY,
  HOOK_PATTERNS,
  MEMORABILITY_PATTERNS,
  POINT_MARKERS,
  REFERENCE_CORPUS,
  SELF_INTRO_PATTERNS,
  VIRALITY_PATTERNS,
  type HookPatternKey,
} from "./lexicon";

/**
 * 日本語の発話速度の想定値（文字／秒）。
 * TikTok の縦型ショート動画は通常会話より速い（7〜9文字/秒）ため 7.5 を採用。
 * TODO(Phase 3): 完成動画の文字起こしから実測値を学習して置き換える。
 */
export const CHARS_PER_SECOND = 7.5;

export interface ScriptInput {
  title: string;
  genre: GenreKey;
  target: string;
  /** 想定動画尺（秒） */
  expectedDuration: number;
  content: string;
}

export interface ScriptFeatures {
  // --- 基本量 ---
  charCount: number;
  sentenceCount: number;
  lineCount: number;
  /** 台本から推定される発話時間（秒） */
  estimatedDurationSeconds: number;
  /** 推定尺 ÷ 想定尺。1.0 が理想 */
  durationRatio: number;

  // --- 冒頭（フック） ---
  openingText: string;
  openingCharCount: number;
  /** 冒頭部分が占める秒数 */
  openingSeconds: number;
  /** 冒頭に含まれるフック種別の数（0-6） */
  hookSignalTypes: number;
  hookSignals: Record<HookPatternKey, number>;
  hasNumberInOpening: boolean;
  hasSelfIntroInOpening: boolean;
  /** 本題に入るまでの推定秒数 */
  timeToPointSeconds: number;

  // --- 好奇心維持 ---
  questionCount: number;
  newInfoCount: number;
  foreshadowCount: number;
  gapCount: number;
  listMarkerCount: number;
  /** 新情報の投入間隔（秒）。小さいほど間延びしない */
  newInfoIntervalSeconds: number;

  // --- 共感・感情 ---
  empathyCount: number;
  emotionCounts: Record<string, number>;
  emotionTypeCount: number;

  // --- 拡散・記憶 ---
  shareTriggerCount: number;
  saveTriggerCount: number;
  commentTriggerCount: number;
  followTriggerCount: number;
  memorabilityCount: number;

  // --- ターゲット適合 ---
  /** 台本とターゲット記述の語の重なり率（0-1） */
  targetOverlapRatio: number;
  /** ジャンル頻出語のヒット数 */
  genreVocabularyHits: number;
  /** ターゲット記述が具体的か（文字数・属性語の有無から判定） */
  targetSpecificity: number;

  // --- 新規性 ---
  /** 参照コーパスとの最大類似度（0-1） */
  maxSimilarity: number;
  /** 最も似ていた参照コンテンツのジャンル */
  mostSimilarGenre: string;
  /** 文字bigramのユニーク率（表現の多様性） */
  lexicalDiversity: number;

  // --- 構成・情報密度 ---
  segments: StructureSegment[];
  hasHook: boolean;
  hasContext: boolean;
  hasDevelopment: boolean;
  hasPeak: boolean;
  hasEnding: boolean;
  /** オチ・締めの位置（0-1）。1.0 に近いほど最後にある */
  endingPositionRatio: number;
  /** 意味単位数（文＋列挙マーカー） */
  semanticUnits: number;
  /** 30秒あたりの意味単位数 */
  unitsPer30Seconds: number;
  /** 1文あたりの平均文字数。長すぎると冗長 */
  averageSentenceLength: number;
}

/** 全角・半角の表記ゆれを吸収した検索用テキストを作る。 */
function normalize(text: string): string {
  return text
    .replace(/[Ａ-Ｚａ-ｚ０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .toLowerCase();
}

function countMatches(text: string, patterns: readonly string[]): number {
  let total = 0;
  for (const pattern of patterns) {
    const needle = normalize(pattern);
    if (!needle) continue;
    let index = text.indexOf(needle);
    while (index !== -1) {
      total += 1;
      index = text.indexOf(needle, index + needle.length);
    }
  }
  return total;
}

function hasAny(text: string, patterns: readonly string[]): boolean {
  return patterns.some((pattern) => text.includes(normalize(pattern)));
}

/** 台本を文単位に分割する。改行・句点・感嘆符を区切りとして扱う。 */
export function splitSentences(content: string): string[] {
  return content
    .split(/\n+/)
    .flatMap((line) => line.split(/(?<=[。！？!?])/))
    .map((sentence) => stripStageDirection(sentence).trim())
    .filter((sentence) => sentence.length > 0);
}

/**
 * 【フック】やト書き（）などの台本記法を、本文から取り除く。
 * 記法自体は構造推定のヒントに使うため、削除前の文字列も参照できるようにしている。
 */
function stripStageDirection(sentence: string): string {
  return sentence.replace(/^\s*[（(【\[][^）)】\]]*[）)】\]]\s*/g, "");
}

/** 文字bigram集合を作る（簡易的な意味的類似度の代替）。 */
function bigrams(text: string): Map<string, number> {
  const cleaned = normalize(text).replace(/[\s、。！？!?,.]/g, "");
  const map = new Map<string, number>();
  for (let i = 0; i < cleaned.length - 1; i += 1) {
    const gram = cleaned.slice(i, i + 2);
    map.set(gram, (map.get(gram) ?? 0) + 1);
  }
  return map;
}

/** bigram のコサイン類似度。0-1。 */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (const [gram, count] of a) {
    normA += count * count;
    const other = b.get(gram);
    if (other) dot += count * other;
  }
  for (const count of b.values()) normB += count * count;
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * 台本を HOOK / CONTEXT / DEVELOPMENT / PEAK / ENDING に分解する（仕様書 §7-6）。
 * Ver.1 は位置とマーカーによるルールベース。
 * TODO(Phase 2): LLM による構造抽出に差し替える。
 */
function extractSegments(sentences: string[], totalChars: number): StructureSegment[] {
  if (sentences.length === 0) return [];

  const normalized = sentences.map(normalize);
  const lengths = sentences.map((sentence) => sentence.length);
  const cumulative: number[] = [];
  let running = 0;
  for (const length of lengths) {
    cumulative.push(running);
    running += length;
  }

  // HOOK: 冒頭から、本題マーカーまたは列挙マーカーが出る直前まで（最大でも全体の 25%）
  const maxHookIndex = Math.max(1, Math.ceil(sentences.length * 0.25));
  let hookEnd = 1;
  for (let i = 0; i < Math.min(sentences.length, maxHookIndex + 1); i += 1) {
    if (hasAny(normalized[i], [...POINT_MARKERS, ...CURIOSITY_PATTERNS.list]) && i > 0) {
      hookEnd = i;
      break;
    }
    hookEnd = Math.min(i + 1, maxHookIndex);
  }

  // ENDING: 末尾から締めマーカーを探す（最後の 30% の範囲のみ）
  let endingStart = sentences.length - 1;
  const endingSearchFrom = Math.max(hookEnd, Math.floor(sentences.length * 0.7));
  for (let i = endingSearchFrom; i < sentences.length; i += 1) {
    if (hasAny(normalized[i], ENDING_MARKERS)) {
      endingStart = i;
      break;
    }
  }
  endingStart = Math.max(endingStart, hookEnd);

  // PEAK: HOOK と ENDING の間で、感情・強調表現が最も密な文
  let peakIndex = endingStart;
  let peakScore = -1;
  for (let i = hookEnd; i < endingStart; i += 1) {
    const emphasis =
      countMatches(normalized[i], Object.values(EMOTION_PATTERNS).flat()) +
      countMatches(normalized[i], CURIOSITY_PATTERNS.gap) +
      countMatches(normalized[i], HOOK_PATTERNS.surprise);
    // 後半にあるほどクライマックスらしい、という位置の重みを掛ける
    const positional = emphasis * (0.6 + (0.4 * i) / Math.max(1, endingStart));
    if (positional > peakScore) {
      peakScore = positional;
      peakIndex = i;
    }
  }
  if (peakScore <= 0) {
    // 感情表現が見つからない場合は、構造的に後半 3/4 の位置を PEAK とみなす
    peakIndex = hookEnd + Math.floor((endingStart - hookEnd) * 0.75);
  }
  peakIndex = Math.min(Math.max(peakIndex, hookEnd), endingStart);

  // CONTEXT / DEVELOPMENT: HOOK と PEAK の間を前半／後半に分ける
  const middleLength = peakIndex - hookEnd;
  const contextEnd = hookEnd + Math.max(middleLength > 0 ? 1 : 0, Math.floor(middleLength / 2));

  const ranges: { key: StructureSegment["key"]; label: string; from: number; to: number }[] = [
    { key: "HOOK", label: "フック", from: 0, to: hookEnd },
    { key: "CONTEXT", label: "前提・状況", from: hookEnd, to: contextEnd },
    { key: "DEVELOPMENT", label: "展開", from: contextEnd, to: peakIndex },
    { key: "PEAK", label: "山場", from: peakIndex, to: endingStart },
    { key: "ENDING", label: "締め・オチ", from: endingStart, to: sentences.length },
  ];

  return ranges
    .filter((range) => range.to > range.from)
    .map((range) => {
      const startChar = cumulative[range.from] ?? totalChars;
      const endChar = (cumulative[range.to - 1] ?? 0) + (lengths[range.to - 1] ?? 0);
      return {
        key: range.key,
        label: range.label,
        text: sentences.slice(range.from, range.to).join(" "),
        startRatio: totalChars === 0 ? 0 : startChar / totalChars,
        endRatio: totalChars === 0 ? 0 : Math.min(1, endChar / totalChars),
        estimatedStartSeconds: Number((startChar / CHARS_PER_SECOND).toFixed(1)),
      };
    });
}

export function extractFeatures(input: ScriptInput): ScriptFeatures {
  const content = input.content ?? "";
  const sentences = splitSentences(content);
  const body = sentences.join("");
  const normalizedBody = normalize(body);
  const charCount = body.length;
  const lineCount = content.split(/\n/).filter((line) => line.trim().length > 0).length;
  const estimatedDurationSeconds = charCount / CHARS_PER_SECOND;
  const expectedDuration = Math.max(1, input.expectedDuration);

  // --- 冒頭（最初の1文、ただし長い場合は先頭40文字まで） ---
  const firstSentence = sentences[0] ?? "";
  const openingText = firstSentence.length > 40 ? firstSentence.slice(0, 40) : firstSentence;
  const normalizedOpening = normalize(openingText);

  const hookSignals = Object.fromEntries(
    (Object.keys(HOOK_PATTERNS) as HookPatternKey[]).map((key) => [
      key,
      countMatches(normalizedOpening, HOOK_PATTERNS[key]),
    ]),
  ) as Record<HookPatternKey, number>;
  const hookSignalTypes = Object.values(hookSignals).filter((count) => count > 0).length;

  // 本題までの時間：本題マーカーが最初に現れる位置の文字数から推定
  let timeToPointChars = charCount;
  for (const marker of POINT_MARKERS) {
    const index = normalizedBody.indexOf(normalize(marker));
    if (index !== -1) timeToPointChars = Math.min(timeToPointChars, index);
  }

  // --- 好奇心維持 ---
  const questionCount = countMatches(normalizedBody, HOOK_PATTERNS.question);
  const newInfoCount = countMatches(normalizedBody, CURIOSITY_PATTERNS.newInfo);
  const foreshadowCount = countMatches(normalizedBody, CURIOSITY_PATTERNS.foreshadow);
  const gapCount = countMatches(normalizedBody, CURIOSITY_PATTERNS.gap);
  const listMarkerCount = countMatches(normalizedBody, CURIOSITY_PATTERNS.list);

  // --- 感情 ---
  const emotionCounts = Object.fromEntries(
    Object.entries(EMOTION_PATTERNS).map(([emotion, patterns]) => [
      emotion,
      countMatches(normalizedBody, patterns),
    ]),
  );
  const emotionTypeCount = Object.values(emotionCounts).filter((count) => count > 0).length;

  // --- ターゲット適合 ---
  const targetOverlapRatio = contentOverlap(input.target, body);
  const genreVocabularyHits = countMatches(
    normalizedBody,
    GENRE_VOCABULARY[input.genre] ?? [],
  );

  // --- 新規性（類似コンテンツ検索） ---
  const scriptBigrams = bigrams(`${input.title} ${body}`);
  let maxSimilarity = 0;
  let mostSimilarGenre = "";
  for (const reference of REFERENCE_CORPUS) {
    const similarity = cosineSimilarity(scriptBigrams, bigrams(reference.text));
    if (similarity > maxSimilarity) {
      maxSimilarity = similarity;
      mostSimilarGenre = reference.genre;
    }
  }
  const totalBigrams = Array.from(scriptBigrams.values()).reduce((sum, n) => sum + n, 0);
  const lexicalDiversity = totalBigrams === 0 ? 0 : scriptBigrams.size / totalBigrams;

  // --- 構成 ---
  const segments = extractSegments(sentences, charCount);
  const segmentKeys = new Set(segments.map((segment) => segment.key));
  const endingSegment = segments.find((segment) => segment.key === "ENDING");

  const semanticUnits = sentences.length + listMarkerCount;
  const unitsPer30Seconds =
    estimatedDurationSeconds === 0 ? 0 : (semanticUnits / estimatedDurationSeconds) * 30;

  return {
    charCount,
    sentenceCount: sentences.length,
    lineCount,
    estimatedDurationSeconds: Number(estimatedDurationSeconds.toFixed(1)),
    durationRatio: Number((estimatedDurationSeconds / expectedDuration).toFixed(3)),

    openingText,
    openingCharCount: openingText.length,
    openingSeconds: Number((openingText.length / CHARS_PER_SECOND).toFixed(1)),
    hookSignalTypes,
    hookSignals,
    hasNumberInOpening: /[0-9０-９一二三四五六七八九十百千万]/.test(openingText),
    hasSelfIntroInOpening: hasAny(normalizedOpening, SELF_INTRO_PATTERNS),
    timeToPointSeconds: Number((timeToPointChars / CHARS_PER_SECOND).toFixed(1)),

    questionCount,
    newInfoCount,
    foreshadowCount,
    gapCount,
    listMarkerCount,
    newInfoIntervalSeconds:
      newInfoCount === 0
        ? Number(estimatedDurationSeconds.toFixed(1))
        : Number((estimatedDurationSeconds / newInfoCount).toFixed(1)),

    empathyCount: countMatches(normalizedBody, EMPATHY_PATTERNS),
    emotionCounts,
    emotionTypeCount,

    shareTriggerCount: countMatches(normalizedBody, VIRALITY_PATTERNS.share),
    saveTriggerCount: countMatches(normalizedBody, VIRALITY_PATTERNS.save),
    commentTriggerCount: countMatches(normalizedBody, VIRALITY_PATTERNS.comment),
    followTriggerCount: countMatches(normalizedBody, VIRALITY_PATTERNS.follow),
    memorabilityCount: countMatches(normalizedBody, MEMORABILITY_PATTERNS),

    targetOverlapRatio: Number(targetOverlapRatio.toFixed(3)),
    genreVocabularyHits,
    targetSpecificity: targetSpecificity(input.target),

    maxSimilarity: Number(maxSimilarity.toFixed(3)),
    mostSimilarGenre,
    lexicalDiversity: Number(lexicalDiversity.toFixed(3)),

    segments,
    hasHook: segmentKeys.has("HOOK"),
    hasContext: segmentKeys.has("CONTEXT"),
    hasDevelopment: segmentKeys.has("DEVELOPMENT"),
    hasPeak: segmentKeys.has("PEAK"),
    hasEnding: segmentKeys.has("ENDING") && hasAny(normalize(endingSegment?.text ?? ""), ENDING_MARKERS),
    endingPositionRatio: endingSegment ? Number(endingSegment.startRatio.toFixed(3)) : 1,
    semanticUnits,
    unitsPer30Seconds: Number(unitsPer30Seconds.toFixed(2)),
    averageSentenceLength:
      sentences.length === 0 ? 0 : Number((charCount / sentences.length).toFixed(1)),
  };
}

/**
 * ターゲット記述と台本の「語の重なり率」（0-1）。
 *
 * 形態素解析を使わないため、内容語になりやすい漢字・カタカナの連続から
 * 文字bigramを取り出し、その一致率で近似する。助詞・かなだけの並びは除外する。
 * TODO(Phase 2): 形態素解析または埋め込みベクトルによる意味的一致に置き換える。
 */
function contentOverlap(target: string, body: string): number {
  const targetGrams = contentBigrams(target);
  if (targetGrams.size === 0) return 0;
  const bodyGrams = contentBigrams(body);
  let hits = 0;
  for (const gram of targetGrams) {
    if (bodyGrams.has(gram)) hits += 1;
  }
  return hits / targetGrams.size;
}

/** 漢字・カタカナの連続（内容語になりやすい部分）から文字bigramを取り出す。 */
function contentBigrams(text: string): Set<string> {
  const grams = new Set<string>();
  const runs = normalize(text).match(/[一-龥々ヶ]{2,}|[ァ-ヴー]{2,}/g) ?? [];
  for (const run of runs) {
    if (run.length === 2) {
      grams.add(run);
      continue;
    }
    for (let i = 0; i < run.length - 1; i += 1) grams.add(run.slice(i, i + 2));
  }
  return grams;
}

/**
 * ターゲット記述の具体性（0-1）。
 * 年代・性別・状況などの属性語が含まれるほど高い。
 */
function targetSpecificity(target: string): number {
  const attributes = [
    /[0-9０-９]{2}代/,
    /(男性|女性|男子|女子|ママ|パパ|主婦|学生|社会人|新卒|経営者|フリーランス)/,
    /(初心者|中級者|上級者|未経験|経験者)/,
    /(悩|困|したい|なりたい|始めたい|伸ばしたい)/,
  ];
  const hits = attributes.filter((pattern) => pattern.test(target)).length;
  const lengthScore = Math.min(1, target.trim().length / 30);
  return Number(Math.min(1, hits / attributes.length + lengthScore * 0.3).toFixed(3));
}
