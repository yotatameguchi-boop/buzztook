"use client";

import { analyzeScriptAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { CHARS_PER_SECOND } from "@/lib/analysis/features";
import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";

export function ScriptEditorForm({
  projectId,
  expectedDuration,
  initialContent,
  latestVersion,
}: {
  projectId: string;
  expectedDuration: number;
  initialContent: string;
  latestVersion: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(analyzeScriptAction, {});
  const [content, setContent] = useState(initialContent);

  const stats = useMemo(() => {
    const charCount = content.replace(/\s/g, "").length;
    const estimated = charCount / CHARS_PER_SECOND;
    const ratio = expectedDuration === 0 ? 0 : estimated / expectedDuration;
    return { charCount, estimated, ratio };
  }, [content, expectedDuration]);

  const ratioTone =
    stats.ratio > 1.25 ? "text-bad" : stats.ratio < 0.7 && stats.charCount > 0 ? "text-mid" : "text-good";

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="projectId" value={projectId} />

      <Textarea
        name="content"
        rows={18}
        required
        minLength={20}
        maxLength={20000}
        value={content}
        onChange={(event) => setContent(event.target.value)}
        placeholder={
          "台本を入力してください。\n\n改行や句点で文を区切ると、構造（フック→前提→展開→山場→締め）の推定精度が上がります。\n【フック】などの見出しやト書き（カッコ書き）は分析時に自動で除外されます。"
        }
        className="font-mono text-[13px]"
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] text-ink-faint tabular">
        <span>{stats.charCount} 文字</span>
        <span>
          推定尺 <span className={ratioTone}>{stats.estimated.toFixed(1)}秒</span>
          <span className="text-ink-faint">（想定尺 {expectedDuration}秒）</span>
        </span>
        <span>発話速度の想定：{CHARS_PER_SECOND} 文字/秒</span>
        <span>保存すると v{latestVersion + 1} として記録されます</span>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton />
        <p className="text-[11px] text-ink-faint">
          保存と同時に10項目の分析を実行します（数百ミリ秒で完了します）。
        </p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "分析中…" : "保存して分析する"}
    </Button>
  );
}
