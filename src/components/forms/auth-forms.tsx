"use client";

import { signInAction, signUpAction, type ActionState } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export function SignInForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="メールアドレス" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="パスワード" htmlFor="password">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </Field>

      <ErrorText message={state.error} />
      <SubmitButton idle="ログイン" busy="確認中…" />
    </form>
  );
}

export function SignUpForm({ inviteRequired }: { inviteRequired: boolean }) {
  const [state, formAction] = useActionState<ActionState, FormData>(signUpAction, {});

  return (
    <form action={formAction} className="space-y-4">
      <Field label="名前" htmlFor="name">
        <Input id="name" name="name" autoComplete="name" required maxLength={80} />
      </Field>

      <Field label="メールアドレス" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>

      <Field label="パスワード" htmlFor="password" hint="8文字以上">
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
        />
      </Field>

      {inviteRequired ? (
        <Field label="招待コード" htmlFor="inviteCode" hint="現在はクローズドデモのため必須です">
          <Input id="inviteCode" name="inviteCode" required />
        </Field>
      ) : null}

      <ErrorText message={state.error} />
      <SubmitButton idle="登録して始める" busy="登録中…" />
    </form>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-bad/40 bg-bad/10 px-3 py-2 text-xs text-bad">{message}</p>
  );
}

function SubmitButton({ idle, busy }: { idle: string; busy: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? busy : idle}
    </Button>
  );
}
