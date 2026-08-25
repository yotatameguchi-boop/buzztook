import { SignUpForm } from "@/components/forms/auth-forms";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getSessionUserId } from "@/lib/auth/session";
import Link from "next/link";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (await getSessionUserId()) redirect("/");

  // INVITE_CODE が設定されているときだけ招待コード欄を出す
  const inviteRequired = Boolean(process.env.INVITE_CODE);

  return (
    <Card>
      <CardHeader title="新規登録" />
      <CardBody className="space-y-5">
        <SignUpForm inviteRequired={inviteRequired} />
        <p className="text-center text-xs text-ink-faint">
          登録済みの場合は{" "}
          <Link href="/login" className="text-brand hover:underline">
            ログイン
          </Link>
        </p>
      </CardBody>
    </Card>
  );
}
