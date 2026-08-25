"use server";

import { signIn, signOut } from "@/lib/auth/config";
import { hashPassword } from "@/lib/auth/password";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import {
  createProject,
  createProjectSchema,
  saveScriptAndAnalyze,
  saveScriptSchema,
} from "@/lib/services/script-service";
import { AuthError } from "next-auth";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export interface ActionState {
  error?: string;
}

// --- 認証 -------------------------------------------------------------------

const signUpSchema = z
  .object({
    name: z.string().trim().min(1, "名前を入力してください").max(80),
    email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません"),
    password: z.string().min(8, "パスワードは8文字以上にしてください").max(200),
    inviteCode: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    // INVITE_CODE が設定されている場合のみ招待制になる（クローズドデモ運用）
    const required = process.env.INVITE_CODE;
    if (required && value.inviteCode !== required) {
      ctx.addIssue({ code: "custom", message: "招待コードが正しくありません", path: ["inviteCode"] });
    }
  });

export async function signUpAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = signUpSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    inviteCode: formData.get("inviteCode") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const repository = getRepository();
  const existing = await repository.findUserByEmail(parsed.data.email);
  if (existing) return { error: "このメールアドレスは既に登録されています" };

  await repository.createUser({
    email: parsed.data.email,
    name: parsed.data.name,
    passwordHash: await hashPassword(parsed.data.password),
  });

  await signIn("credentials", {
    email: parsed.data.email,
    password: parsed.data.password,
    redirectTo: "/",
  });

  return {};
}

export async function signInAction(_state: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/",
    });
    return {};
  } catch (error) {
    // signIn は成功時にリダイレクト用の例外を投げるため、認証エラーだけを捕まえる
    if (error instanceof AuthError) {
      return { error: "メールアドレスまたはパスワードが正しくありません" };
    }
    throw error;
  }
}

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

// --- プロジェクト -----------------------------------------------------------

/** 新規プロジェクト作成（仕様書 §23 Task 3 の入力項目）。 */
export async function createProjectAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = createProjectSchema.safeParse({
    title: formData.get("title"),
    genre: formData.get("genre"),
    targetDescription: formData.get("targetDescription"),
    expectedDuration: formData.get("expectedDuration"),
    accountId: formData.get("accountId") || null,
    script: formData.get("script") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  const project = await createProject(userId, parsed.data);
  revalidatePath("/");
  redirect(`/projects/${project.id}/script`);
}

/** 台本を新バージョンとして保存し、そのまま分析する。 */
export async function analyzeScriptAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const projectId = String(formData.get("projectId") ?? "");
  const parsed = saveScriptSchema.safeParse({ content: formData.get("content") });

  if (!projectId) return { error: "プロジェクトが指定されていません" };
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "台本を確認してください" };
  }

  const { analysis } = await saveScriptAndAnalyze(projectId, userId, parsed.data.content);
  revalidatePath("/");
  revalidatePath(`/projects/${projectId}`);
  redirect(`/projects/${projectId}/analyses/${analysis.id}`);
}

const accountSchema = z.object({
  displayName: z.string().trim().min(1, "アカウント名を入力してください").max(80),
  followerCount: z.coerce.number().int().min(0, "0以上で入力してください").max(100_000_000),
  category: z.string().trim().max(80).optional(),
});

export async function createAccountAction(
  _state: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = accountSchema.safeParse({
    displayName: formData.get("displayName"),
    followerCount: formData.get("followerCount"),
    category: formData.get("category") ?? undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  }

  await getRepository().createAccount(userId, {
    displayName: parsed.data.displayName,
    followerCount: parsed.data.followerCount,
    category: parsed.data.category?.trim() ? parsed.data.category : null,
  });

  revalidatePath("/accounts");
  revalidatePath("/projects/new");
  return {};
}

export async function deleteProjectAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const projectId = String(formData.get("projectId") ?? "");
  if (!projectId) return;

  await getRepository().deleteProject(projectId, userId);
  revalidatePath("/");
  redirect("/");
}
