/**
 * 仕様書 §16 POST /projects/:id/results/sync … 投稿後データ同期
 *
 * Phase 4 の範囲。Ver.1 では未実装（501）。
 * TODO(Phase 4): TikTok API の規約・審査を確認のうえ、post_results / comments を同期する
 *                （仕様書 §14 Source A）。実績が入ったら予測との誤差を計算し、
 *                Phase 5 の学習型スコアリングの入力にする。
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "未実装",
      detail: "投稿実績の同期は Phase 4（TikTok連携）で実装予定です（仕様書 §21）。",
      phase: "PHASE_4",
    },
    { status: 501 },
  );
}
