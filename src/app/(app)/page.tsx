import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import {
  GENRE_LABELS,
  PROJECT_STATUS_LABELS,
  type GenreKey,
  type ProjectStatus,
} from "@/lib/domain/types";
import { formatDateTime, formatDuration, percentileTone } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

const STATUS_TONE: Record<ProjectStatus, "neutral" | "brand" | "accent"> = {
  DRAFT: "neutral",
  SCRIPT_ANALYZED: "brand",
  VIDEO_UPLOADED: "neutral",
  VIDEO_ANALYZED: "brand",
  POSTED: "accent",
  RESULT_COLLECTED: "accent",
};

export default async function DashboardPage() {
  const userId = await requireUserId();
  const projects = await getRepository().listProjects(userId);
  const analyzed = projects.filter((project) => project.latestAnalysis);
  const averagePercentile =
    analyzed.length === 0
      ? null
      : analyzed.reduce((sum, project) => sum + (project.latestAnalysis?.overallPercentile ?? 0), 0) /
        analyzed.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">ダッシュボード</h1>
          <p className="mt-1 text-sm text-ink-muted">
            投稿前に台本を分析し、改善してから撮影に進むためのワークスペース。
          </p>
        </div>
        <ButtonLink href="/projects/new">新規分析を作成</ButtonLink>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="プロジェクト" value={projects.length.toString()} unit="件" />
        <StatCard label="分析済み" value={analyzed.length.toString()} unit="件" />
        <StatCard
          label="平均バズポテンシャル"
          value={averagePercentile === null ? "—" : toTopPercentText(averagePercentile)}
          unit={averagePercentile === null ? "" : "（同ジャンル比較）"}
          tone={averagePercentile === null ? undefined : percentileTone(averagePercentile)}
        />
      </div>

      <Card>
        <CardHeader
          title="プロジェクト"
          description="1本のコンテンツ制作単位。台本のバージョンと分析履歴を束ねます。"
        />

        {projects.length === 0 ? (
          <CardBody className="py-14 text-center">
            <p className="text-sm text-ink-muted">まだプロジェクトがありません。</p>
            <p className="mt-1 text-xs text-ink-faint">
              タイトル・ジャンル・ターゲット・想定尺・台本を入力すると、10項目の分析が始まります。
            </p>
            <ButtonLink href="/projects/new" className="mt-5">
              最初の分析を作成
            </ButtonLink>
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((project) => {
              const analysis = project.latestAnalysis;
              return (
                <li key={project.id}>
                  <Link
                    href={`/projects/${project.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{project.title}</p>
                        <Badge tone={STATUS_TONE[project.status]}>
                          {PROJECT_STATUS_LABELS[project.status]}
                        </Badge>
                      </div>
                      <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-faint">
                        <span>{GENRE_LABELS[project.genre as GenreKey] ?? project.genre}</span>
                        <span>{formatDuration(project.expectedDuration)}</span>
                        <span>台本 {project.scriptCount} バージョン</span>
                        {project.account ? <span>@{project.account.displayName}</span> : null}
                        <span className="tabular">更新 {formatDateTime(project.updatedAt)}</span>
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      {analysis ? (
                        <>
                          <p
                            className={`text-lg font-bold tabular ${TONE_TEXT[percentileTone(analysis.overallPercentile)]}`}
                          >
                            {toTopPercentText(analysis.overallPercentile)}
                          </p>
                          <p className="text-[11px] text-ink-faint tabular">
                            スコア {analysis.overallScore.toFixed(1)}
                          </p>
                        </>
                      ) : (
                        <p className="text-xs text-ink-faint">未分析</p>
                      )}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  tone?: "good" | "mid" | "bad";
}) {
  return (
    <Card>
      <CardBody>
        <p className="text-xs text-ink-muted">{label}</p>
        <p className="mt-2 flex items-baseline gap-1.5">
          <span className={`text-2xl font-bold tabular ${tone ? TONE_TEXT[tone] : "text-ink"}`}>
            {value}
          </span>
          {unit ? <span className="text-[11px] text-ink-faint">{unit}</span> : null}
        </p>
      </CardBody>
    </Card>
  );
}
