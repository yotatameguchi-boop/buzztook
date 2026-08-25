import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { AXIS_LABELS } from "@/lib/domain/types";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * 完成動画分析（仕様書 §4.2 / §12）。
 *
 * Phase 3 の実装範囲のため、Ver.1 では画面の骨組みと比較の枠組みのみを用意する。
 * 未実装であることを UI 上で明示し、モックのスコアは一切表示しない。
 */
const PIPELINE = [
  "動画アップロード（S3互換ストレージ）",
  "音声抽出 → 文字起こし",
  "映像フレーム解析 → カット検出",
  "OCR / テロップ解析（表示量・タイミング）",
  "特徴量統合 → 10項目スコア",
  "台本分析との比較（Realization Gap）",
];

export default async function VideoAnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await requireUserId();
  const project = await getRepository().getProject(id, userId);
  if (!project) notFound();

  const latestAnalysis = project.scripts.flatMap((entry) => entry.analyses)[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">完成動画分析</h1>
            <Badge tone="mid">Phase 3｜未実装</Badge>
          </div>
          <p className="mt-1 text-sm text-ink-muted">{project.title}</p>
        </div>
        <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
          プロジェクト詳細
        </ButtonLink>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="アップロード"
            description="この機能は Phase 3 で実装します。現時点ではアップロードできません。"
          />
          <CardBody>
            <div className="grid place-items-center rounded-lg border border-dashed border-line-strong bg-surface-2 px-6 py-12 text-center">
              <p className="text-sm text-ink-muted">動画ファイルをドロップ</p>
              <p className="mt-1 text-[11px] text-ink-faint">
                API: POST /api/projects/:id/videos（現在 501 を返します）
              </p>
            </div>

            <ol className="mt-5 space-y-2">
              {PIPELINE.map((step, index) => (
                <li key={step} className="flex items-start gap-2.5 text-xs text-ink-muted">
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border border-line text-[10px] text-ink-faint tabular">
                    {index + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="比較の基準（台本分析の結果）"
            description="完成動画分析が実装されると、この値と実際の動画のスコアを突き合わせます。"
          />
          <CardBody>
            {latestAnalysis ? (
              <>
                <div className="flex items-baseline gap-3">
                  <span className="text-xs text-ink-muted">Script Potential</span>
                  <span className="text-2xl font-bold text-brand tabular">
                    {toTopPercentText(latestAnalysis.overallPercentile)}
                  </span>
                </div>

                <ul className="mt-4 space-y-2">
                  {latestAnalysis.payload.axes.map((axis) => (
                    <li key={axis.key} className="flex items-center justify-between text-xs">
                      <span className="text-ink-muted">{AXIS_LABELS[axis.key]}</span>
                      <span className="flex items-center gap-3 tabular">
                        <span className="text-ink">{toTopPercentText(axis.percentile)}</span>
                        <span className="text-ink-faint">→ 動画：—</span>
                      </span>
                    </li>
                  ))}
                </ul>

                <p className="mt-5 rounded-md border border-line bg-surface-2 px-3 py-2 text-[11px] leading-relaxed text-ink-faint">
                  realization_gap = script_score − video_score（仕様書 §12）。
                  ギャップが大きい場合、冒頭の間・テロップの遅れ・セリフのテンポなどが原因候補になります。
                </p>
              </>
            ) : (
              <p className="text-sm text-ink-muted">
                先に台本分析を実行してください。比較の基準になります。
              </p>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
