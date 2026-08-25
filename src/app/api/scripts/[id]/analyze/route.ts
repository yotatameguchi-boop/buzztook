/**
 * 仕様書 §16
 * POST /api/scripts/:id/analyze … 台本分析開始
 *
 * レスポンスは仕様書のサンプルに合わせ、overall_percentile / scores / display_axes /
 * improvements を含む形にする（overall_percentile = 88 は「上位12%」の意味）。
 */

import { apiUser } from "@/lib/auth/session";
import { analyzeScript, NotFoundError } from "@/lib/services/script-service";
import { AXIS_KEYS, METRIC_KEYS } from "@/lib/domain/types";
import { NextResponse } from "next/server";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const { id } = await params;

  try {
    const analysis = await analyzeScript(id, userId);
    const result = analysis.payload;

    return NextResponse.json({
      analysis_id: analysis.id,
      overall_percentile: result.overallPercentile,
      overall_score: result.overallScore,
      confidence: result.overallConfidence,
      scores: Object.fromEntries(METRIC_KEYS.map((key) => [key, result.scores[key]])),
      display_axes: Object.fromEntries(
        AXIS_KEYS.map((key) => [key, result.axes.find((axis) => axis.key === key)?.score ?? 0]),
      ),
      populations: result.populations,
      improvements: result.improvements,
      model_version: result.modelVersion,
      scoring_version: result.scoringVersion,
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
