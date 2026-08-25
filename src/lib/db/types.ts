/**
 * 永続化層のレコード型とリポジトリインターフェース。
 *
 * 仕様書 §15 の DB 設計に対応する。API/UI 側は Prisma にも JSON ストアにも依存せず、
 * この Repository インターフェースだけを見る。
 */

import type { ProjectStatus, ScriptAnalysisResult } from "@/lib/domain/types";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/** パスワードハッシュを含むユーザー。認証処理の内部でのみ使う。 */
export interface UserWithSecret extends UserRecord {
  passwordHash: string;
}

export interface CreateUserInput {
  email: string;
  name: string;
  passwordHash: string;
}

export interface AccountRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  platform: string;
  externalAccountId: string | null;
  displayName: string;
  followerCount: number;
  category: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectRecord {
  id: string;
  userId: string;
  accountId: string | null;
  title: string;
  genre: string;
  targetDescription: string;
  expectedDuration: number;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScriptRecord {
  id: string;
  projectId: string;
  version: number;
  content: string;
  createdAt: string;
}

export interface ScriptAnalysisRecord {
  id: string;
  scriptId: string;
  overallScore: number;
  overallPercentile: number;
  confidenceScore: number;
  /** 分析結果の完全なスナップショット（DB では JSON 文字列として保存） */
  payload: ScriptAnalysisResult;
  modelVersion: string;
  scoringVersion: string;
  createdAt: string;
}

/** プロジェクト一覧に出す集計付きのレコード */
export interface ProjectSummary extends ProjectRecord {
  account: AccountRecord | null;
  scriptCount: number;
  latestAnalysis: ScriptAnalysisRecord | null;
}

export interface ProjectDetail extends ProjectRecord {
  account: AccountRecord | null;
  scripts: ScriptWithAnalysis[];
}

export interface ScriptWithAnalysis {
  script: ScriptRecord;
  analyses: ScriptAnalysisRecord[];
}

export interface CreateProjectInput {
  title: string;
  genre: string;
  targetDescription: string;
  expectedDuration: number;
  accountId: string | null;
}

export interface CreateAccountInput {
  displayName: string;
  followerCount: number;
  category: string | null;
  externalAccountId?: string | null;
}

/**
 * 永続化層のインターフェース。
 * 実装は PrismaRepository（PostgreSQL）と JsonRepository（ローカル開発用）の2つ。
 *
 * 重要：プロジェクト・台本・分析結果はユーザーの資産（投稿前の企画）なので、
 * 取得系・更新系のメソッドはすべて userId を受け取り、所有者以外には返さない。
 */
export interface Repository {
  readonly driver: "prisma" | "json";

  // --- 認証 ---
  findUserByEmail(email: string): Promise<UserWithSecret | null>;
  getUserById(userId: string): Promise<UserRecord | null>;
  createUser(input: CreateUserInput): Promise<UserRecord>;

  // --- アカウント ---
  listAccounts(userId: string): Promise<AccountRecord[]>;
  createAccount(userId: string, input: CreateAccountInput): Promise<AccountRecord>;

  // --- プロジェクト ---
  listProjects(userId: string): Promise<ProjectSummary[]>;
  createProject(userId: string, input: CreateProjectInput): Promise<ProjectRecord>;
  getProject(projectId: string, userId: string): Promise<ProjectDetail | null>;
  deleteProject(projectId: string, userId: string): Promise<void>;

  /** 台本を新しいバージョンとして保存する（仕様書 §23 Task 7：台本バージョン管理）。 */
  createScript(projectId: string, userId: string, content: string): Promise<ScriptRecord>;
  getScript(scriptId: string, userId: string): Promise<ScriptRecord | null>;

  saveScriptAnalysis(
    scriptId: string,
    userId: string,
    result: ScriptAnalysisResult,
  ): Promise<ScriptAnalysisRecord>;
  getScriptAnalysis(analysisId: string, userId: string): Promise<ScriptAnalysisRecord | null>;

  /** OWN_HISTORY 比較用：同一アカウントの過去分析の総合スコア一覧。 */
  listOverallScoresForAccount(
    accountId: string | null,
    userId: string,
    excludeProjectId?: string,
  ): Promise<number[]>;
}
