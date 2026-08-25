/**
 * ローカル開発用の JSON ファイルストア。
 *
 * DATABASE_URL が未設定のとき（= PostgreSQL を用意していない環境）に使われる。
 * スキーマは prisma/schema.prisma と同じ形を保つ。本番では PrismaRepository を使うこと。
 */

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ProjectStatus, ScriptAnalysisResult } from "@/lib/domain/types";
import type {
  AccountRecord,
  CreateAccountInput,
  CreateProjectInput,
  CreateUserInput,
  ProjectDetail,
  ProjectRecord,
  ProjectSummary,
  Repository,
  ScriptAnalysisRecord,
  ScriptRecord,
  UserRecord,
  UserWithSecret,
} from "./types";

interface Database {
  users: UserWithSecret[];
  accounts: AccountRecord[];
  projects: ProjectRecord[];
  scripts: ScriptRecord[];
  scriptAnalyses: ScriptAnalysisRecord[];
}

const DATA_DIR = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIR, "buzztook.json");

function emptyDatabase(): Database {
  return { users: [], accounts: [], projects: [], scripts: [], scriptAnalyses: [] };
}

/** パスワードハッシュを落としたユーザーを返す。 */
function toPublicUser(user: UserWithSecret): UserRecord {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class JsonRepository implements Repository {
  readonly driver = "json" as const;

  /** 書き込みの競合を避けるため、操作を直列化する。 */
  private queue: Promise<unknown> = Promise.resolve();

  private async read(): Promise<Database> {
    try {
      const raw = await readFile(DATA_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<Database>;
      return { ...emptyDatabase(), ...parsed };
    } catch {
      return emptyDatabase();
    }
  }

  private async write(database: Database): Promise<void> {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(DATA_FILE, JSON.stringify(database, null, 2), "utf8");
  }

  /** 読み → 変更 → 書き を直列に実行する。 */
  private transaction<T>(mutate: (database: Database) => T | Promise<T>): Promise<T> {
    const next = this.queue.then(async () => {
      const database = await this.read();
      const result = await mutate(database);
      await this.write(database);
      return result;
    });
    // 失敗しても後続の操作が止まらないようにする
    this.queue = next.catch(() => undefined);
    return next;
  }

  /** 指定ユーザーが所有するプロジェクトIDの集合。 */
  private ownedProjectIds(database: Database, userId: string): Set<string> {
    return new Set(
      database.projects.filter((project) => project.userId === userId).map((project) => project.id),
    );
  }

  // --- 認証 ---

  async findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const database = await this.read();
    const normalized = email.trim().toLowerCase();
    return database.users.find((user) => user.email === normalized) ?? null;
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const database = await this.read();
    const user = database.users.find((candidate) => candidate.id === userId);
    return user ? toPublicUser(user) : null;
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    return this.transaction((database) => {
      const now = new Date().toISOString();
      const user: UserWithSecret = {
        id: randomUUID(),
        email: input.email.trim().toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
        createdAt: now,
        updatedAt: now,
      };
      if (database.users.some((candidate) => candidate.email === user.email)) {
        throw new Error("このメールアドレスは既に登録されています");
      }
      database.users.push(user);
      return toPublicUser(user);
    });
  }

  // --- アカウント ---

  async listAccounts(userId: string): Promise<AccountRecord[]> {
    const database = await this.read();
    return database.accounts
      .filter((account) => account.userId === userId)
      .sort((a, b) => a.displayName.localeCompare(b.displayName, "ja"));
  }

  async createAccount(userId: string, input: CreateAccountInput): Promise<AccountRecord> {
    return this.transaction((database) => {
      const now = new Date().toISOString();
      const account: AccountRecord = {
        id: randomUUID(),
        userId,
        organizationId: null,
        platform: "tiktok",
        externalAccountId: input.externalAccountId ?? null,
        displayName: input.displayName,
        followerCount: input.followerCount,
        category: input.category,
        createdAt: now,
        updatedAt: now,
      };
      database.accounts.push(account);
      return account;
    });
  }

  // --- プロジェクト ---

  async listProjects(userId: string): Promise<ProjectSummary[]> {
    const database = await this.read();
    return database.projects
      .filter((project) => project.userId === userId)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .map((project) => {
        const scripts = database.scripts.filter((script) => script.projectId === project.id);
        const scriptIds = new Set(scripts.map((script) => script.id));
        const analyses = database.scriptAnalyses
          .filter((analysis) => scriptIds.has(analysis.scriptId))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
        return {
          ...project,
          account: database.accounts.find((account) => account.id === project.accountId) ?? null,
          scriptCount: scripts.length,
          latestAnalysis: analyses[0] ?? null,
        };
      });
  }

  async createProject(userId: string, input: CreateProjectInput): Promise<ProjectRecord> {
    return this.transaction((database) => {
      // 他人のアカウントを紐付けられないようにする
      const account = input.accountId
        ? database.accounts.find(
            (candidate) => candidate.id === input.accountId && candidate.userId === userId,
          )
        : null;

      const now = new Date().toISOString();
      const project: ProjectRecord = {
        id: randomUUID(),
        userId,
        accountId: account?.id ?? null,
        title: input.title,
        genre: input.genre,
        targetDescription: input.targetDescription,
        expectedDuration: input.expectedDuration,
        status: "DRAFT",
        createdAt: now,
        updatedAt: now,
      };
      database.projects.push(project);
      return project;
    });
  }

  async getProject(projectId: string, userId: string): Promise<ProjectDetail | null> {
    const database = await this.read();
    const project = database.projects.find(
      (candidate) => candidate.id === projectId && candidate.userId === userId,
    );
    if (!project) return null;

    const scripts = database.scripts
      .filter((script) => script.projectId === projectId)
      .sort((a, b) => b.version - a.version)
      .map((script) => ({
        script,
        analyses: database.scriptAnalyses
          .filter((analysis) => analysis.scriptId === script.id)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }));

    return {
      ...project,
      account: database.accounts.find((account) => account.id === project.accountId) ?? null,
      scripts,
    };
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    await this.transaction((database) => {
      const project = database.projects.find(
        (candidate) => candidate.id === projectId && candidate.userId === userId,
      );
      if (!project) return;

      const scriptIds = new Set(
        database.scripts.filter((script) => script.projectId === projectId).map((s) => s.id),
      );
      database.projects = database.projects.filter((candidate) => candidate.id !== projectId);
      database.scripts = database.scripts.filter((script) => script.projectId !== projectId);
      database.scriptAnalyses = database.scriptAnalyses.filter(
        (analysis) => !scriptIds.has(analysis.scriptId),
      );
    });
  }

  // --- 台本・分析 ---

  async createScript(projectId: string, userId: string, content: string): Promise<ScriptRecord> {
    return this.transaction((database) => {
      const project = database.projects.find(
        (candidate) => candidate.id === projectId && candidate.userId === userId,
      );
      if (!project) throw new Error("プロジェクトが見つかりません");

      const versions = database.scripts
        .filter((script) => script.projectId === projectId)
        .map((script) => script.version);
      const script: ScriptRecord = {
        id: randomUUID(),
        projectId,
        version: versions.length === 0 ? 1 : Math.max(...versions) + 1,
        content,
        createdAt: new Date().toISOString(),
      };
      database.scripts.push(script);
      project.updatedAt = script.createdAt;
      return script;
    });
  }

  async getScript(scriptId: string, userId: string): Promise<ScriptRecord | null> {
    const database = await this.read();
    const script = database.scripts.find((candidate) => candidate.id === scriptId);
    if (!script) return null;
    return this.ownedProjectIds(database, userId).has(script.projectId) ? script : null;
  }

  async saveScriptAnalysis(
    scriptId: string,
    userId: string,
    result: ScriptAnalysisResult,
  ): Promise<ScriptAnalysisRecord> {
    return this.transaction((database) => {
      const script = database.scripts.find((candidate) => candidate.id === scriptId);
      const project = database.projects.find((candidate) => candidate.id === script?.projectId);
      if (!script || !project || project.userId !== userId) {
        throw new Error("台本が見つかりません");
      }

      const record: ScriptAnalysisRecord = {
        id: randomUUID(),
        scriptId,
        overallScore: result.overallScore,
        overallPercentile: result.overallPercentile,
        confidenceScore: confidenceToNumber(result.overallConfidence),
        payload: result,
        modelVersion: result.modelVersion,
        scoringVersion: result.scoringVersion,
        createdAt: new Date().toISOString(),
      };
      database.scriptAnalyses.push(record);

      project.updatedAt = record.createdAt;
      project.status = advanceStatus(project.status, "SCRIPT_ANALYZED");

      return record;
    });
  }

  async getScriptAnalysis(analysisId: string, userId: string): Promise<ScriptAnalysisRecord | null> {
    const database = await this.read();
    const analysis = database.scriptAnalyses.find((candidate) => candidate.id === analysisId);
    if (!analysis) return null;

    const script = database.scripts.find((candidate) => candidate.id === analysis.scriptId);
    if (!script) return null;

    return this.ownedProjectIds(database, userId).has(script.projectId) ? analysis : null;
  }

  async listOverallScoresForAccount(
    accountId: string | null,
    userId: string,
    excludeProjectId?: string,
  ): Promise<number[]> {
    if (!accountId) return [];
    const database = await this.read();
    const projectIds = new Set(
      database.projects
        .filter(
          (project) =>
            project.accountId === accountId &&
            project.userId === userId &&
            project.id !== excludeProjectId,
        )
        .map((project) => project.id),
    );
    const scriptIds = new Set(
      database.scripts.filter((script) => projectIds.has(script.projectId)).map((s) => s.id),
    );
    return database.scriptAnalyses
      .filter((analysis) => scriptIds.has(analysis.scriptId))
      .map((analysis) => analysis.overallScore);
  }
}

/** 信頼度ラベル → 0-1 の数値（DB の confidence_score カラム用） */
export function confidenceToNumber(level: "HIGH" | "MEDIUM" | "LOW"): number {
  return level === "HIGH" ? 0.85 : level === "MEDIUM" ? 0.6 : 0.35;
}

/** ステータスは後戻りさせない（例：投稿済みのプロジェクトを台本分析済みに戻さない）。 */
export function advanceStatus(current: ProjectStatus, next: ProjectStatus): ProjectStatus {
  const order: ProjectStatus[] = [
    "DRAFT",
    "SCRIPT_ANALYZED",
    "VIDEO_UPLOADED",
    "VIDEO_ANALYZED",
    "POSTED",
    "RESULT_COLLECTED",
  ];
  return order.indexOf(next) > order.indexOf(current) ? next : current;
}
