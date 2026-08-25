/**
 * アプリケーションサービス層。
 * API Routes / Server Actions / UI は、永続化層と分析エンジンを直接触らずここを経由する。
 */

import { getScriptAnalyzer } from "@/lib/analysis";
import { getRepository } from "@/lib/db";
import type { ProjectDetail, ScriptAnalysisRecord, ScriptRecord } from "@/lib/db/types";
import { isGenreKey, type GenreKey } from "@/lib/domain/types";
import { z } from "zod";

export const createProjectSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(120),
  genre: z.string().refine(isGenreKey, "ジャンルを選択してください"),
  targetDescription: z.string().trim().min(1, "ターゲットを入力してください").max(300),
  expectedDuration: z.coerce
    .number()
    .int("秒数は整数で入力してください")
    .min(5, "想定尺は5秒以上にしてください")
    .max(600, "想定尺は600秒以下にしてください"),
  accountId: z.string().nullable().optional(),
  /** 作成と同時に台本を保存する場合 */
  script: z.string().optional(),
});

export type CreateProjectInputDto = z.infer<typeof createProjectSchema>;

export const saveScriptSchema = z.object({
  content: z.string().trim().min(20, "台本は20文字以上入力してください").max(20000),
});

export async function createProject(userId: string, input: CreateProjectInputDto) {
  const repository = getRepository();
  const project = await repository.createProject(userId, {
    title: input.title,
    genre: input.genre,
    targetDescription: input.targetDescription,
    expectedDuration: input.expectedDuration,
    accountId: input.accountId ?? null,
  });

  if (input.script && input.script.trim().length > 0) {
    await repository.createScript(project.id, userId, input.script);
  }

  return project;
}

export async function saveScript(
  projectId: string,
  userId: string,
  content: string,
): Promise<ScriptRecord> {
  return getRepository().createScript(projectId, userId, content);
}

/**
 * 台本分析の実行（仕様書 §16 POST /scripts/:id/analyze）。
 *
 * 分析エンジンの入力に必要な投稿条件（ジャンル・ターゲット・想定尺）は
 * プロジェクトから引く。過去分析は OWN_HISTORY 比較の母集団に使う。
 */
export async function analyzeScript(
  scriptId: string,
  userId: string,
): Promise<ScriptAnalysisRecord> {
  const repository = getRepository();

  const script = await repository.getScript(scriptId, userId);
  if (!script) throw new NotFoundError("台本が見つかりません");

  const project = await repository.getProject(script.projectId, userId);
  if (!project) throw new NotFoundError("プロジェクトが見つかりません");

  const ownHistoryScores = await repository.listOverallScoresForAccount(
    project.accountId,
    userId,
    project.id,
  );

  const analyzer = getScriptAnalyzer();
  const result = await analyzer.analyze(
    {
      title: project.title,
      genre: project.genre as GenreKey,
      target: project.targetDescription,
      expectedDuration: project.expectedDuration,
      content: script.content,
    },
    {
      followerCount: project.account?.followerCount,
      ownHistoryScores,
    },
  );

  return repository.saveScriptAnalysis(script.id, userId, result);
}

/** 台本を新バージョンとして保存し、そのまま分析する（UI の主要導線）。 */
export async function saveScriptAndAnalyze(projectId: string, userId: string, content: string) {
  const script = await saveScript(projectId, userId, content);
  const analysis = await analyzeScript(script.id, userId);
  return { script, analysis };
}

export async function getProjectOrThrow(projectId: string, userId: string): Promise<ProjectDetail> {
  const project = await getRepository().getProject(projectId, userId);
  if (!project) throw new NotFoundError("プロジェクトが見つかりません");
  return project;
}

export class NotFoundError extends Error {}
