import { deleteProjectAction } from "@/app/actions";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import {
  GENRE_LABELS,
  PROJECT_STATUS_LABELS,
  type GenreKey,
} from "@/lib/domain/types";
import { formatDateTime, formatDuration, formatFollowers, percentileTone } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const project = await getRepository().getProject(id, userId);
  if (!project) notFound();

  const analysedVersions = project.scripts.filter((entry) => entry.analyses.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">{project.title}</h1>
            <Badge>{PROJECT_STATUS_LABELS[project.status]}</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-faint tabular">
            作成 {formatDateTime(project.createdAt)}／更新 {formatDateTime(project.updatedAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {analysedVersions.length >= 2 ? (
            <ButtonLink href={`/projects/${project.id}/compare`} variant="secondary" size="sm">
              バージョン比較
            </ButtonLink>
          ) : null}
          <ButtonLink href={`/projects/${project.id}/script`} size="sm">
            台本を書く
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader title="コンテンツ条件" />
          <CardBody>
            <dl className="space-y-3 text-xs">
              <Row label="ジャンル" value={GENRE_LABELS[project.genre as GenreKey] ?? project.genre} />
              <Row label="想定尺" value={formatDuration(project.expectedDuration)} />
              <Row label="ターゲット" value={project.targetDescription} />
              <Row
                label="投稿予定アカウント"
                value={
                  project.account
                    ? `${project.account.displayName}（${formatFollowers(project.account.followerCount)}フォロワー）`
                    : "未設定"
                }
              />
            </dl>
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader
            title="台本バージョンと分析履歴"
            description="台本を保存するたびに新しいバージョンが作られ、分析結果が紐づきます（仕様書 §23 Task 7）。"
          />

          {project.scripts.length === 0 ? (
            <CardBody className="py-10 text-center">
              <p className="text-sm text-ink-muted">まだ台本がありません。</p>
              <ButtonLink href={`/projects/${project.id}/script`} className="mt-4" size="sm">
                台本を書く
              </ButtonLink>
            </CardBody>
          ) : (
            <ul className="divide-y divide-line">
              {project.scripts.map((entry) => {
                const latest = entry.analyses[0];
                return (
                  <li key={entry.script.id} className="px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-ink">
                            v{entry.script.version}
                          </span>
                          <span className="text-[11px] text-ink-faint tabular">
                            {formatDateTime(entry.script.createdAt)}
                          </span>
                          <span className="text-[11px] text-ink-faint tabular">
                            {entry.script.content.replace(/\s/g, "").length}文字
                          </span>
                        </div>
                        <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-ink-muted">
                          {entry.script.content.slice(0, 140)}
                          {entry.script.content.length > 140 ? "…" : ""}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        {latest ? (
                          <Link
                            href={`/projects/${project.id}/analyses/${latest.id}`}
                            className="block"
                          >
                            <span
                              className={`text-lg font-bold tabular ${TONE_TEXT[percentileTone(latest.overallPercentile)]}`}
                            >
                              {toTopPercentText(latest.overallPercentile)}
                            </span>
                            <span className="mt-0.5 block text-[11px] text-ink-faint">
                              分析結果を見る
                            </span>
                          </Link>
                        ) : (
                          <span className="text-xs text-ink-faint">未分析</span>
                        )}
                      </div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ButtonLink
                        href={`/projects/${project.id}/script?from=${entry.script.id}`}
                        variant="secondary"
                        size="sm"
                      >
                        このバージョンから修正
                      </ButtonLink>
                      {entry.analyses.length > 1 ? (
                        <span className="self-center text-[11px] text-ink-faint">
                          分析 {entry.analyses.length} 件
                        </span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>

      <Card className="border-dashed">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">完成動画分析（Phase 3）</p>
            <p className="mt-1 text-xs text-ink-muted">
              撮影・編集が終わったら動画をアップロードして、台本とのギャップを確認します。
            </p>
          </div>
          <ButtonLink href={`/projects/${project.id}/video`} variant="secondary" size="sm">
            開く
          </ButtonLink>
        </CardBody>
      </Card>

      <form action={deleteProjectAction}>
        <input type="hidden" name="projectId" value={project.id} />
        <Button type="submit" variant="danger" size="sm">
          このプロジェクトを削除
        </Button>
      </form>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] text-ink-faint">{label}</dt>
      <dd className="mt-0.5 leading-relaxed text-ink">{value}</dd>
    </div>
  );
}
