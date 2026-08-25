/**
 * 仕様書 §16 GET /projects/:id/comparison … 台本と完成動画の比較
 *
 * Phase 3 の範囲。Ver.1 では未実装（501）。
 * TODO(Phase 3): realization_gap = script_score - video_score を返す（仕様書 §12）。
 */

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    {
      error: "未実装",
      detail: "台本と完成動画の比較は Phase 3 で実装予定です（仕様書 §12）。",
      phase: "PHASE_3",
    },
    { status: 501 },
  );
}
