"use client";

import { createProjectAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { AccountRecord } from "@/lib/db/types";
import { GENRE_KEYS, GENRE_LABELS } from "@/lib/domain/types";
import { formatFollowers } from "@/lib/utils";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

const DURATION_PRESETS = [15, 30, 45, 60, 90, 120];

export function NewProjectForm({ accounts }: { accounts: AccountRecord[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createProjectAction, {});

  return (
    <form action={formAction} className="space-y-5">
      <Field label="動画タイトル" htmlFor="title">
        <Input
          id="title"
          name="title"
          required
          maxLength={120}
          placeholder="例：知らないと損する動画編集の設定3つ"
        />
      </Field>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="動画ジャンル" htmlFor="genre" hint="ジャンルごとに評価の重みが変わります（仕様書 §11）">
          <Select id="genre" name="genre" required defaultValue="education">
            {GENRE_KEYS.map((genre) => (
              <option key={genre} value={genre}>
                {GENRE_LABELS[genre]}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="想定動画尺（秒）"
          htmlFor="expectedDuration"
          hint={`目安：${DURATION_PRESETS.join(" / ")} 秒`}
        >
          <Input
            id="expectedDuration"
            name="expectedDuration"
            type="number"
            min={5}
            max={600}
            step={5}
            defaultValue={30}
            required
          />
        </Field>
      </div>

      <Field
        label="ターゲット"
        htmlFor="targetDescription"
        hint="具体的なほど精度が上がります。年代・状況・悩みまで書いてください。"
      >
        <Textarea
          id="targetDescription"
          name="targetDescription"
          rows={2}
          required
          maxLength={300}
          placeholder="例：動画編集を始めて3ヶ月、書き出し設定でつまずいている20代の副業クリエイター"
        />
      </Field>

      <Field
        label="投稿予定アカウント"
        htmlFor="accountId"
        hint="フォロワー規模はスコア補正と比較母集団の選択に使われます（任意）"
      >
        <Select id="accountId" name="accountId" defaultValue="">
          <option value="">未選択</option>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.displayName}（{formatFollowers(account.followerCount)}フォロワー）
            </option>
          ))}
        </Select>
      </Field>

      {state.error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {state.error}
        </p>
      ) : null}

      <div className="flex items-center gap-3 pt-1">
        <SubmitButton />
        <p className="text-[11px] text-ink-faint">次の画面で台本を入力します。</p>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "作成中…" : "台本入力へ進む"}
    </Button>
  );
}
