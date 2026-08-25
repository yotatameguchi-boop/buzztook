/**
 * 仕様書 §16
 * GET  /api/projects  … プロジェクト一覧
 * POST /api/projects  … 新規コンテンツプロジェクト作成
 */

import { apiUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { createProject, createProjectSchema } from "@/lib/services/script-service";
import { NextResponse } from "next/server";

export async function GET() {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const projects = await getRepository().listProjects(userId);
  return NextResponse.json({ projects });
}

export async function POST(request: Request) {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const body = await request.json().catch(() => null);
  const parsed = createProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストが不正です", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const project = await createProject(userId, parsed.data);
  return NextResponse.json({ project }, { status: 201 });
}
