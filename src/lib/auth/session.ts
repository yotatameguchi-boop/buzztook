/**
 * サーバー側でログイン中のユーザーIDを解決するヘルパー。
 *
 * 画面・Server Action・API Route はすべてここを通す。
 * 「userId を引数で受け取る」形にしてあるリポジトリ層と組み合わせることで、
 * 他人のデータに触れる経路を作りにくくしている。
 */

import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";

export class UnauthorizedError extends Error {
  constructor() {
    super("ログインが必要です");
  }
}

/** ログイン中のユーザーID。未ログインなら null。 */
export async function getSessionUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

/** 画面用：未ログインならログイン画面へリダイレクトする。 */
export async function requireUserId(): Promise<string> {
  const userId = await getSessionUserId();
  if (!userId) redirect("/login");
  return userId;
}

/**
 * API 用：ログイン中なら userId、未ログインなら 401 レスポンスを返す。
 *
 * 戻り値を判別して使う:
 *   const auth = await apiUser();
 *   if (auth.response) return auth.response;
 *   auth.userId を使う
 */
export async function apiUser(): Promise<
  { userId: string; response: null } | { userId: null; response: NextResponse }
> {
  const userId = await getSessionUserId();
  if (!userId) {
    return {
      userId: null,
      response: NextResponse.json({ error: "ログインが必要です" }, { status: 401 }),
    };
  }
  return { userId, response: null };
}
