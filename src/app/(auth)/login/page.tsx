import { SignInForm } from "@/components/forms/auth-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // ログイン済みならダッシュボードへ
  if (await getSessionUserId()) redirect("/");

  return (
    <Card>
      <CardHeader title="ログイン" />
      <CardBody className="space-y-5">
        <SignInForm />
        <p className="text-center text-xs text-ink-faint">
          アカウントがない場合は{" "}
          <Link href="/signup" className="text-brand hover:underline">
            新規登録
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
