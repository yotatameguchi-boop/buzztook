/**
 * 仕様書 §22-3：すべての分析結果に model_version / scoring_version を保存する。
 * アルゴリズムを変更したら必ずここを上げること（過去結果との比較可能性を保つため）。
 */

/** 特徴量抽出モデルのバージョン。features.ts を変更したら上げる。 */
export const MODEL_VERSION = "rule-v1.1.0";

/** スコアリング（重み・補正・パーセンタイル変換）のバージョン。scoring.ts / percentile.ts を変更したら上げる。 */
export const SCORING_VERSION = "score-v1.1.0";
