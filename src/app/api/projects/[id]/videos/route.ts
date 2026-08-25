/**
 * 仕様書 §16 POST /projects/:id/videos … 完成動画アップロード
 *
 * Phase 3 の範囲。Ver.1 では未実装（501）。
 * TODO(Phase 3): S3互換ストレージへの署名付きURL発行 → videos レコード作成 →
 *                非同期ジョブ（BullMQ/Inngest）で Video Analysis Service を起動する。
 */

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "未実装",
      detail: "完成動画分析は Phase 3 で実装予定です（仕様書 §21）。",
      phase: "PHASE_3",
    },
    { status: 501 },
  );
}
