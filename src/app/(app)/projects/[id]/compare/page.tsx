import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { toTopPercentText } from "@/lib/analysis/percentile";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import type { ScriptAnalysisRecord } from "@/lib/db/types";
import { AXIS_LABELS, METRIC_KEYS, METRIC_LABELS } from "@/lib/domain/types";
import { formatDateTime, percentileTone } from "@/lib/utils";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

const TONE_TEXT = { good: "text-good", mid: "text-mid", bad: "text-bad" } as const;

/**
 * 台本バージョン比較（仕様書 §23 Task 7：修正前後を比較できるようにする）。
 *
 * 注意：スコアは model_version / scoring_version が同じ場合にのみ厳密に比較できる。
 * 異なるバージョン間の比較には警告を出す（仕様書 §22-3）。
 */
export default async function ComparePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { id } = await params;
  const { a, b } = await searchParams;

  const userId = await requireUserId();
  const project = await getRepository().getProject(id, userId);
  if (!project) notFound();

  // 分析済みのバージョンを新しい順に並べる
  const entries = project.scripts
    .filter((entry) => entry.analyses.length > 0)
    .map((entry) => ({ version: entry.script.version, analysis: entry.analyses[0] }));

  if (entries.length < 2) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-xl font-bold tracking-tight text-ink">バージョン比較</h1>
        <Card>
          <CardBody className="py-10 text-center">
            <p className="text-sm text-ink-muted">
              比較するには、分析済みの台本バージョンが2つ以上必要です。
            </p>
            <ButtonLink href={`/projects/${project.id}/script`} className="mt-4" size="sm">
              台本を修正して再分析する
            </ButtonLink>
          </CardBody>
        </Card>
      </div>
    );
  }

  const after = entries.find((entry) => entry.analysis.id === b) ?? entries[0];
  const before = entries.find((entry) => entry.analysis.id === a) ?? entries[1];

  const versionMismatch =
    before.analysis.scoringVersion !== after.analysis.scoringVersion ||
    before.analysis.modelVersion !== after.analysis.modelVersion;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">バージョン比較</h1>
          <p className="mt-1 text-sm text-ink-muted">{project.title}</p>
        </div>
        <ButtonLink href={`/projects/${project.id}`} variant="secondary" size="sm">
          プロジェクト詳細
        </ButtonLink>
      </div>

      <Card>
        <CardHeader title="比較対象" description="修正前（A）と修正後（B）を選びます。" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <VersionPicker
            label="A（修正前）"
            projectId={project.id}
            entries={entries}
            selected={before.analysis.id}
            other={after.analysis.id}
            paramKey="a"
          />
          <VersionPicker
            label="B（修正後）"
            projectId={project.id}
            entries={entries}
            selected={after.analysis.id}
            other={before.analysis.id}
            paramKey="b"
          />
        </CardBody>
      </Card>

      {versionMismatch ? (
        <p className="rounded-lg border border-mid/40 bg-mid/10 px-3 py-2 text-xs text-mid">
          スコアリングのバージョンが異なる分析同士を比較しています（A:{" "}
          {before.analysis.scoringVersion} / B: {after.analysis.scoringVersion}）。
          差分にはアルゴリズム変更の影響が含まれます。
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader title="総合バズポテンシャル" />
          <CardBody className="space-y-4">
            <div className="flex items-end justify-between">
              <SideValue label={`v${before.version}`} analysis={before.analysis} />
              <span className="pb-2 text-lg text-ink-faint">→</span>
              <SideValue label={`v${after.version}`} analysis={after.analysis} />
            </div>
            <DeltaRow
              label="パーセンタイル"
              before={before.analysis.overallPercentile}
              after={after.analysis.overallPercentile}
              unit="pt"
            />
            <DeltaRow
              label="内部スコア"
              before={before.analysis.overallScore}
              after={after.analysis.overallScore}
              unit="点"
            />
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="5軸の変化" description="表示用の5軸（仕様書 §10）でのパーセンタイル差分。" />
          <CardBody className="space-y-2.5">
            {after.analysis.payload.axes.map((axis) => {
              const beforeAxis = before.analysis.payload.axes.find(
                (candidate) => candidate.key === axis.key,
              );
              return (
                <DeltaRow
                  key={axis.key}
                  label={AXIS_LABELS[axis.key]}
                  before={beforeAxis?.percentile ?? 0}
                  after={axis.percentile}
                  unit="pt"
                  showTopPercent
                />
              );
            })}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="10項目の変化" />
        <CardBody className="grid gap-x-8 gap-y-2.5 sm:grid-cols-2">
          {METRIC_KEYS.map((metric) => {
            const beforeMetric = before.analysis.payload.metrics.find((entry) => entry.key === metric);
            const afterMetric = after.analysis.payload.metrics.find((entry) => entry.key === metric);
            return (
              <DeltaRow
                key={metric}
                label={METRIC_LABELS[metric]}
                before={beforeMetric?.percentile ?? 0}
                after={afterMetric?.percentile ?? 0}
                unit="pt"
                showTopPercent
              />
            );
          })}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title={`v${before.version} の改善提案`} />
          <CardBody>
            <ImprovementSummary analysis={before.analysis} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`v${after.version} の改善提案`} />
          <CardBody>
            <ImprovementSummary analysis={after.analysis} />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function VersionPicker({
  label,
  projectId,
  entries,
  selected,
  other,
  paramKey,
}: {
  label: string;
  projectId: string;
  entries: { version: number; analysis: ScriptAnalysisRecord }[];
  selected: string;
  other: string;
  paramKey: "a" | "b";
}) {
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-ink-muted">{label}</p>
      <div className="flex flex-wrap gap-1.5">
        {entries.map((entry) => {
          const query =
            paramKey === "a"
              ? `a=${entry.analysis.id}&b=${other}`
              : `a=${other}&b=${entry.analysis.id}`;
          const isSelected = entry.analysis.id === selected;
          return (
            <Link
              key={entry.analysis.id}
              href={`/projects/${projectId}/compare?${query}`}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${
                isSelected
                  ? "border-brand bg-brand/10 text-brand"
                  : "border-line bg-surface-2 text-ink-muted hover:border-line-strong"
              }`}
            >
              v{entry.version}
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-ink-faint tabular">
        {formatDateTime(entries.find((entry) => entry.analysis.id === selected)?.analysis.createdAt ?? "")}
      </p>
    </div>
  );
}

function SideValue({ label, analysis }: { label: string; analysis: ScriptAnalysisRecord }) {
  return (
    <div>
      <p className="text-[11px] text-ink-faint">{label}</p>
      <p
        className={`text-2xl font-bold tabular ${TONE_TEXT[percentileTone(analysis.overallPercentile)]}`}
      >
        {toTopPercentText(analysis.overallPercentile)}
      </p>
    </div>
  );
}

function DeltaRow({
  label,
  before,
  after,
  unit,
  showTopPercent = false,
}: {
  label: string;
  before: number;
  after: number;
  unit: string;
  showTopPercent?: boolean;
}) {
  const delta = after - before;
  const tone = delta > 0.5 ? "text-good" : delta < -0.5 ? "text-bad" : "text-ink-faint";
  const sign = delta > 0 ? "+" : "";

  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-ink-muted">{label}</span>
      <span className="flex items-center gap-2 tabular">
        <span className="text-ink-faint">
          {showTopPercent ? toTopPercentText(before) : before.toFixed(1)}
        </span>
        <span className="text-ink-faint">→</span>
        <span className="text-ink">
          {showTopPercent ? toTopPercentText(after) : after.toFixed(1)}
        </span>
        <span className={`w-16 text-right font-semibold ${tone}`}>
          {sign}
          {delta.toFixed(1)}
          {unit}
        </span>
      </span>
    </div>
  );
}

function ImprovementSummary({ analysis }: { analysis: ScriptAnalysisRecord }) {
  const improvements = analysis.payload.improvements;
  if (improvements.length === 0) {
    return <p className="text-xs text-ink-muted">改善提案なし</p>;
  }
  return (
    <ol className="space-y-2">
      {improvements.map((improvement, index) => (
        <li key={improvement.id} className="flex items-start gap-2 text-xs">
          <span className="text-ink-faint tabular">{index + 1}.</span>
          <span className="min-w-0 flex-1 text-ink-muted">{improvement.title}</span>
          <Badge tone={improvement.evidence === "DATA_INSIGHT" ? "brand" : "accent"}>
            {improvement.evidence === "DATA_INSIGHT" ? "DATA" : "AI"}
          </Badge>
        </li>
      ))}
    </ol>
  );
}
