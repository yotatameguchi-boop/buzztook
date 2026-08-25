/**
 * PostgreSQL / Prisma 実装（本番想定）。
 *
 * DATABASE_URL が設定されているときに使われる。
 * スキーマは prisma/schema.prisma（仕様書 §15）。
 */

import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { ProjectStatus, ScriptAnalysisResult } from "@/lib/domain/types";
import { advanceStatus, confidenceToNumber } from "./json-repository";
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

/** 開発時のホットリロードでコネクションが増え続けないようにする。 */
const globalForPrisma = globalThis as unknown as { buzztookPrisma?: PrismaClient };

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.buzztookPrisma) globalForPrisma.buzztookPrisma = createClient();
  return globalForPrisma.buzztookPrisma;
}

type PrismaProject = Awaited<ReturnType<PrismaClient["project"]["findFirstOrThrow"]>>;
type PrismaAccount = Awaited<ReturnType<PrismaClient["account"]["findFirstOrThrow"]>>;
type PrismaScript = Awaited<ReturnType<PrismaClient["script"]["findFirstOrThrow"]>>;
type PrismaAnalysis = Awaited<ReturnType<PrismaClient["scriptAnalysis"]["findFirstOrThrow"]>>;

function toProject(project: PrismaProject): ProjectRecord {
  return {
    id: project.id,
    userId: project.userId,
    accountId: project.accountId,
    title: project.title,
    genre: project.genre,
    targetDescription: project.targetDescription,
    expectedDuration: project.expectedDuration,
    status: project.status as ProjectStatus,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

function toAccount(account: PrismaAccount): AccountRecord {
  return {
    id: account.id,
    userId: account.userId,
    organizationId: account.organizationId,
    platform: account.platform,
    externalAccountId: account.externalAccountId,
    displayName: account.displayName,
    followerCount: account.followerCount,
    category: account.category,
    createdAt: account.createdAt.toISOString(),
    updatedAt: account.updatedAt.toISOString(),
  };
}

function toScript(script: PrismaScript): ScriptRecord {
  return {
    id: script.id,
    projectId: script.projectId,
    version: script.version,
    content: script.content,
    createdAt: script.createdAt.toISOString(),
  };
}

function toAnalysis(analysis: PrismaAnalysis): ScriptAnalysisRecord {
  return {
    id: analysis.id,
    scriptId: analysis.scriptId,
    overallScore: analysis.overallScore,
    overallPercentile: analysis.overallPercentile,
    confidenceScore: analysis.confidenceScore,
    payload: JSON.parse(analysis.payload) as ScriptAnalysisResult,
    modelVersion: analysis.modelVersion,
    scoringVersion: analysis.scoringVersion,
    createdAt: analysis.createdAt.toISOString(),
  };
}

export class PrismaRepository implements Repository {
  readonly driver = "prisma" as const;

  private get prisma(): PrismaClient {
    return getClient();
  }

  // --- 認証 ---

  async findUserByEmail(email: string): Promise<UserWithSecret | null> {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      passwordHash: user.passwordHash,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async getUserById(userId: string): Promise<UserRecord | null> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) return null;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async createUser(input: CreateUserInput): Promise<UserRecord> {
    const user = await this.prisma.user.create({
      data: {
        email: input.email.trim().toLowerCase(),
        name: input.name,
        passwordHash: input.passwordHash,
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async listAccounts(userId: string): Promise<AccountRecord[]> {
    const accounts = await this.prisma.account.findMany({
      where: { userId },
      orderBy: { displayName: "asc" },
    });
    return accounts.map(toAccount);
  }

  async createAccount(userId: string, input: CreateAccountInput): Promise<AccountRecord> {
    const account = await this.prisma.account.create({
      data: {
        userId,
        platform: "tiktok",
        externalAccountId: input.externalAccountId ?? null,
        displayName: input.displayName,
        followerCount: input.followerCount,
        category: input.category,
      },
    });
    return toAccount(account);
  }

  async listProjects(userId: string): Promise<ProjectSummary[]> {
    const projects = await this.prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
      include: {
        account: true,
        scripts: { include: { analyses: { orderBy: { createdAt: "desc" } } } },
      },
    });

    return projects.map((project) => {
      const analyses = project.scripts
        .flatMap((script) => script.analyses)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return {
        ...toProject(project),
        account: project.account ? toAccount(project.account) : null,
        scriptCount: project.scripts.length,
        latestAnalysis: analyses[0] ? toAnalysis(analyses[0]) : null,
      };
    });
  }

  async createProject(userId: string, input: CreateProjectInput): Promise<ProjectRecord> {
    // 他人のアカウントを紐付けられないようにする
    const account = input.accountId
      ? await this.prisma.account.findFirst({ where: { id: input.accountId, userId } })
      : null;

    const project = await this.prisma.project.create({
      data: {
        userId,
        accountId: account?.id ?? null,
        title: input.title,
        genre: input.genre,
        targetDescription: input.targetDescription,
        expectedDuration: input.expectedDuration,
        status: "DRAFT",
      },
    });
    return toProject(project);
  }

  async getProject(projectId: string, userId: string): Promise<ProjectDetail | null> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        account: true,
        scripts: {
          orderBy: { version: "desc" },
          include: { analyses: { orderBy: { createdAt: "desc" } } },
        },
      },
    });
    if (!project) return null;

    return {
      ...toProject(project),
      account: project.account ? toAccount(project.account) : null,
      scripts: project.scripts.map((script) => ({
        script: toScript(script),
        analyses: script.analyses.map(toAnalysis),
      })),
    };
  }

  async deleteProject(projectId: string, userId: string): Promise<void> {
    // 所有者以外の削除要求は黙って無視する（存在の有無も漏らさない）
    await this.prisma.project.deleteMany({ where: { id: projectId, userId } });
  }

  async createScript(projectId: string, userId: string, content: string): Promise<ScriptRecord> {
    const project = await this.prisma.project.findFirst({ where: { id: projectId, userId } });
    if (!project) throw new Error("プロジェクトが見つかりません");

    const latest = await this.prisma.script.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const script = await this.prisma.script.create({
      data: { projectId, version: (latest?.version ?? 0) + 1, content },
    });
    await this.prisma.project.update({
      where: { id: projectId },
      data: { updatedAt: new Date() },
    });
    return toScript(script);
  }

  async getScript(scriptId: string, userId: string): Promise<ScriptRecord | null> {
    const script = await this.prisma.script.findFirst({
      where: { id: scriptId, project: { userId } },
    });
    return script ? toScript(script) : null;
  }

  async saveScriptAnalysis(
    scriptId: string,
    userId: string,
    result: ScriptAnalysisResult,
  ): Promise<ScriptAnalysisRecord> {
    const owned = await this.prisma.script.findFirst({
      where: { id: scriptId, project: { userId } },
    });
    if (!owned) throw new Error("台本が見つかりません");

    const analysis = await this.prisma.scriptAnalysis.create({
      data: {
        scriptId,
        overallScore: result.overallScore,
        overallPercentile: result.overallPercentile,
        hookScore: result.scores.hook,
        curiosityScore: result.scores.curiosity,
        targetFitScore: result.scores.targetFit,
        empathyScore: result.scores.empathy,
        noveltyScore: result.scores.novelty,
        structureScore: result.scores.structure,
        informationDensityScore: result.scores.informationDensity,
        emotionScore: result.scores.emotion,
        viralityScore: result.scores.virality,
        memorabilityScore: result.scores.memorability,
        confidenceScore: confidenceToNumber(result.overallConfidence),
        payload: JSON.stringify(result),
        modelVersion: result.modelVersion,
        scoringVersion: result.scoringVersion,
      },
    });

    // プロジェクトのステータスを進める
    const script = await this.prisma.script.findUnique({
      where: { id: scriptId },
      include: { project: true },
    });
    if (script) {
      await this.prisma.project.update({
        where: { id: script.projectId },
        data: { status: advanceStatus(script.project.status as ProjectStatus, "SCRIPT_ANALYZED") },
      });
    }

    return toAnalysis(analysis);
  }

  async getScriptAnalysis(analysisId: string, userId: string): Promise<ScriptAnalysisRecord | null> {
    const analysis = await this.prisma.scriptAnalysis.findFirst({
      where: { id: analysisId, script: { project: { userId } } },
    });
    return analysis ? toAnalysis(analysis) : null;
  }

  async listOverallScoresForAccount(
    accountId: string | null,
    userId: string,
    excludeProjectId?: string,
  ): Promise<number[]> {
    if (!accountId) return [];
    const analyses = await this.prisma.scriptAnalysis.findMany({
      where: {
        script: {
          project: {
            accountId,
            userId,
            ...(excludeProjectId ? { id: { not: excludeProjectId } } : {}),
          },
        },
      },
      select: { overallScore: true },
    });
    return analyses.map((analysis) => analysis.overallScore);
  }
}
