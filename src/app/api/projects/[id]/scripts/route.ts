/**
 * 仕様書 §16
 * POST /api/projects/:id/scripts … 台本保存（新しいバージョンとして追加）
 */

import { apiUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { saveScript, saveScriptSchema } from "@/lib/services/script-service";
import { NextResponse } from "next/server";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const { id } = await params;

  const project = await getRepository().getProject(id, userId);
  if (!project) return NextResponse.json({ error: "プロジェクトが見つかりません" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const parsed = saveScriptSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストが不正です", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const script = await saveScript(id, userId, parsed.data.content);
  return NextResponse.json({ script }, { status: 201 });
}
