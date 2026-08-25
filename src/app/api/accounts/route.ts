/**
 * 投稿予定アカウントの管理。
 * Ver.1 は手入力のみ（仕様書 §14 Source B）。
 * TODO(Phase 4): TikTok OAuth 連携でアカウント情報・実績を取得する（Source A）。
 */

import { apiUser } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createAccountSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  followerCount: z.coerce.number().int().min(0).max(100_000_000),
  category: z.string().trim().max(80).nullable().optional(),
});

export async function GET() {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const accounts = await getRepository().listAccounts(userId);
  return NextResponse.json({ accounts });
}

export async function POST(request: Request) {
  const auth = await apiUser();
  if (auth.response) return auth.response;
  const userId = auth.userId;
  const body = await request.json().catch(() => null);
  const parsed = createAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "リクエストが不正です", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const account = await getRepository().createAccount(userId, {
    displayName: parsed.data.displayName,
    followerCount: parsed.data.followerCount,
    category: parsed.data.category ?? null,
  });
  return NextResponse.json({ account }, { status: 201 });
}
