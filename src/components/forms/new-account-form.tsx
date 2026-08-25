"use client";

import { createAccountAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export function NewAccountForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(createAccountAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="アカウント名" htmlFor="displayName">
        <Input id="displayName" name="displayName" required maxLength={80} placeholder="例：buzz_studio" />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="フォロワー数" htmlFor="followerCount">
          <Input id="followerCount" name="followerCount" type="number" min={0} defaultValue={0} required />
        </Field>
        <Field label="カテゴリ（任意）" htmlFor="category">
          <Input id="category" name="category" maxLength={80} placeholder="例：ガジェット解説" />
        </Field>
      </div>

      {state.error ? (
        <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" disabled={pending}>
      {pending ? "追加中…" : "アカウントを追加"}
    </Button>
  );
}
