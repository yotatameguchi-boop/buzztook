import { NewProjectForm } from "@/components/forms/new-project-form";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const userId = await requireUserId();
  const accounts = await getRepository().listAccounts(userId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink">新規分析</h1>
        <p className="mt-1 text-sm text-ink-muted">
          企画の条件を登録します。ここで指定した条件が、比較母集団とジャンル別重みの決定に使われます。
        </p>
      </div>

      <Card>
        <CardHeader title="コンテンツ条件" description="仕様書 §4.1 の台本分析の入力項目" />
        <CardBody>
          <NewProjectForm accounts={accounts} />
        </CardBody>
      </Card>
    </div>
  );
}
