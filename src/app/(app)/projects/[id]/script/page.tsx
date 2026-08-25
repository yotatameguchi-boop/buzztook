import { ScriptEditorForm } from "@/components/forms/script-editor-form";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { GENRE_LABELS, type GenreKey } from "@/lib/domain/types";
import { formatDuration } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ScriptEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params;
  const { from } = await searchParams;

  const userId = await requireUserId();
  const project = await getRepository().getProject(id, userId);
  if (!project) notFound();

  const latestVersion = project.scripts[0]?.script.version ?? 0;
  // ?from=<scriptId> が指定されていればそのバージョンを、なければ最新版を下敷きにする
  const source = from
    ? project.scripts.find((entry) => entry.script.id === from)
    : project.scripts[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">{project.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-ink-muted">
            <span>{GENRE_LABELS[project.genre as GenreKey] ?? project.genre}</span>
            <span>{formatDuration(project.expectedDuration)}</span>
            <span>ターゲット：{project.targetDescription}</span>
          </p>
        </div>
        {project.scripts.length > 0 ? (
          <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
            プロジェクト詳細
          </ButtonLink>
        ) : null}
      </div>

      <Card>
        <CardHeader
          title="台本入力"
          description={
            source
              ? `v${source.script.version} を下敷きにしています。編集して保存すると新しいバージョンになります。`
              : "最初のバージョンを作成します。"
          }
        />
        <CardBody>
          <ScriptEditorForm
            projectId={project.id}
            expectedDuration={project.expectedDuration}
            initialContent={source?.script.content ?? ""}
            latestVersion={latestVersion}
          />
        </CardBody>
      </Card>
    </div>
  );
}
