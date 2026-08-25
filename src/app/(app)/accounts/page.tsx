import { NewAccountForm } from "@/components/forms/new-account-form";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import { formatFollowers } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const userId = await requireUserId();
  const accounts = await getRepository().listAccounts(userId);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">アカウント</h1>
        <p className="mt-1 text-sm text-ink-muted">
          投稿予定アカウント。フォロワー規模はスコアの規模補正と「自分の過去投稿」比較に使われます。
        </p>
      </div>

      <Card>
        <CardHeader
          title="登録済みアカウント"
          description="Ver.1 は手入力のみ。TikTok連携（Phase 4）で実績データを取得できるようになります。"
          action={<Badge tone="mid">TikTok連携は Phase 4</Badge>}
        />
        {accounts.length === 0 ? (
          <CardBody className="py-8 text-center text-sm text-ink-muted">
            まだアカウントが登録されていません。
          </CardBody>
        ) : (
          <ul className="divide-y divide-line">
            {accounts.map((account) => (
              <li key={account.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                <div>
                  <p className="text-sm font-medium text-ink">{account.displayName}</p>
                  <p className="mt-0.5 text-[11px] text-ink-faint">
                    {account.category ?? "カテゴリ未設定"}・{account.platform}
                  </p>
                </div>
                <p className="text-sm text-ink-muted tabular">
                  {formatFollowers(account.followerCount)} フォロワー
                </p>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader title="アカウントを追加" />
        <CardBody>
          <NewAccountForm />
        </CardBody>
      </Card>
    </div>
  );
}
