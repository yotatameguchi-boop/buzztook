import { DiamondChart } from "@/components/charts/diamond-chart";
import { ImprovementList } from "@/components/analysis/improvement-list";
import { MetricTable } from "@/components/analysis/metric-table";
import { PopulationList } from "@/components/analysis/population-list";
import { ScoreHeadline } from "@/components/analysis/score-headline";
import { SegmentTimeline } from "@/components/analysis/segment-timeline";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import {
  AXIS_COMPOSITION,
  AXIS_LABELS,
  GENRE_LABELS,
  METRIC_LABELS,
  POPULATION_LABELS,
  type GenreKey,
} from "@/lib/domain/types";
import { formatDateTime, percentileTone } from "@/lib/utils";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

export default async function AnalysisResultPage({
  params,
}: {
  params: Promise<{ id: string; analysisId: string }>;
}) {
  const { id, analysisId } = await params;
  const userId = await requireUserId();
  const repository = getRepository();

  const [project, analysis] = await Promise.all([
    repository.getProject(id, userId),
    repository.getScriptAnalysis(analysisId, userId),
  ]);
  if (!project || !analysis) notFound();

  const result = analysis.payload;
  const script = project.scripts.find((entry) => entry.script.id === analysis.scriptId);
  const genrePopulation = result.populations.find((population) => population.key === "GENRE");

  return (
    <div className="space-y-6">
      {/* ヘッダー */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-ink">{project.title}</h1>
            {script ? <Badge tone="brand">台本 v{script.script.version}</Badge> : null}
          </div>
          <p className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-faint">
            <span>{GENRE_LABELS[project.genre as GenreKey] ?? project.genre}</span>
            <span>想定尺 {project.expectedDuration}秒</span>
            <span className="tabular">分析日時 {formatDateTime(analysis.createdAt)}</span>
            <span className="tabular">
              model {analysis.modelVersion} / scoring {analysis.scoringVersion}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <ButtonLink
            href={`/projects/${project.id}/script?from=${analysis.scriptId}`}
            variant="secondary"
            size="sm"
          >
            台本を修正して再分析
          </ButtonLink>
          <ButtonLink href={`/projects/${project.id}/compare`} variant="secondary" size="sm">
            バージョン比較
          </ButtonLink>
          <ButtonLink href={`/projects/${project.id}/video`} size="sm">
            完成動画分析へ
          </ButtonLink>
        </div>
      </div>

      {/* 総合 + 菱形チャート */}
      <div className="grid gap-4 lg:grid-cols-[1.15fr_1fr]">
        <Card>
          <CardBody className="space-y-6">
            <ScoreHeadline
              percentile={result.overallPercentile}
              score={result.overallScore}
              confidence={result.overallConfidence}
              populationLabel={POPULATION_LABELS.GENRE}
            />
            <DiamondChart axes={result.axes} />
            <ul className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-4 sm:grid-cols-3">
              {result.axes.map((axis) => (
                <li key={axis.key} className="text-[11px]">
                  <span className="text-ink-muted">{AXIS_LABELS[axis.key]}</span>
                  <span className="ml-1.5 text-ink-faint">
                    = {AXIS_COMPOSITION[axis.key].map((metric) => METRIC_LABELS[metric]).join(" + ")}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader
              title="比較母集団"
              description="同じ台本でも、何と比較するかで評価は変わります（仕様書 §9）。"
            />
            <CardBody className="py-1">
              <PopulationList populations={result.populations} />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="強み・弱み" />
            <CardBody className="space-y-4">
              <div>
                <p className="text-[11px] font-medium text-good">強み</p>
                <ul className="mt-1.5 space-y-1">
                  {result.strengths.map((metric) => {
                    const detail = result.metrics.find((entry) => entry.key === metric);
                    return (
                      <li key={metric} className="flex items-center justify-between text-xs">
                        <span className="text-ink">{METRIC_LABELS[metric]}</span>
                        <span
                          className={`font-semibold tabular ${TONE_TEXT[percentileTone(detail?.percentile ?? 0)]}`}
                        >
                          {toTopPercentText(detail?.percentile ?? 0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <div className="border-t border-line pt-3">
                <p className="text-[11px] font-medium text-bad">弱み</p>
                <ul className="mt-1.5 space-y-1">
                  {result.weaknesses.map((metric) => {
                    const detail = result.metrics.find((entry) => entry.key === metric);
                    return (
                      <li key={metric} className="flex items-center justify-between text-xs">
                        <span className="text-ink">{METRIC_LABELS[metric]}</span>
                        <span
                          className={`font-semibold tabular ${TONE_TEXT[percentileTone(detail?.percentile ?? 0)]}`}
                        >
                          {toTopPercentText(detail?.percentile ?? 0)}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      {/* 改善提案 */}
      <Card>
        <CardHeader
          title="改善提案"
          description="優先順位 = 予測影響（Impact） × 信頼度（Confidence）。データ根拠のある指摘とAI提案を分けて表示しています。"
        />
        <ImprovementList improvements={result.improvements} />
      </Card>

      {/* 10項目詳細 */}
      <Card>
        <CardHeader
          title="10項目の内部評価"
          description="行をクリックすると、そのスコアの根拠になった特徴量を確認できます。"
          action={
            genrePopulation ? (
              <span className="text-[11px] text-ink-faint tabular">
                比較母集団：{POPULATION_LABELS.GENRE}（
                {genrePopulation.sampleSize.toLocaleString("ja-JP")}件相当）
              </span>
            ) : null
          }
        />
        <MetricTable metrics={result.metrics} />
      </Card>

      {/* 構造分解 */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="台本の構造"
            description="HOOK → CONTEXT → DEVELOPMENT → PEAK → ENDING への分解（仕様書 §7-6）"
          />
          <CardBody>
            <SegmentTimeline segments={result.segments} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="抽出された特徴量"
            description="スコアの入力になった値。モデル差し替え時の比較のため分析結果に保存されます。"
          />
          <CardBody className="max-h-96 overflow-y-auto">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[11px]">
              {Object.entries(result.features)
                .filter(([, value]) => typeof value !== "string" || value.length < 40)
                .map(([key, value]) => (
                  <div key={key} className="flex items-baseline justify-between gap-2 border-b border-line/60 pb-1">
                    <dt className="truncate text-ink-faint">{key}</dt>
                    <dd className="shrink-0 text-ink-muted tabular">
                      {typeof value === "boolean" ? (value ? "true" : "false") : String(value)}
                    </dd>
                  </div>
                ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      {/* 次のフェーズの案内 */}
      <Card className="border-dashed">
        <CardBody className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-ink">次のステップ：完成動画分析（Phase 3）</p>
            <p className="mt-1 text-xs text-ink-muted">
              撮影・編集後の動画をアップロードすると、この台本分析結果と比較して
              「ポテンシャルを活かせているか（Realization Gap）」を算出します。
            </p>
          </div>
          <ButtonLink href={`/projects/${project.id}/video`} variant="secondary" size="sm">
            完成動画分析を見る
          </ButtonLink>
        </CardBody>
      </Card>
    </div>
  );
}
