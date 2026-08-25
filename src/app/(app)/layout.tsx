import { signOutAction } from "@/app/actions";
import { MODEL_VERSION, SCORING_VERSION } from "@/lib/analysis/version";
import { requireUserId } from "@/lib/auth/session";
import { getRepository } from "@/lib/db";
import Link from "next/link";

/**
 * ログインが必要な画面すべての共通レイアウト。
 *
 * ここで一度だけ認証を確認する。個別ページで requireUserId() を呼び忘れても
 * このレイアウトを通らずに描画されることはない。
 * （ただしデータ取得は必ず userId でスコープすること。表示の可否とデータの所有権は別問題）
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireUserId();
  const repository = getRepository();
  const user = await repository.getUserById(userId);

  const nav = [
    { href: "/", label: "ダッシュボード" },
    { href: "/projects/new", label: "新規分析" },
    { href: "/accounts", label: "アカウント" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center gap-4 px-6 sm:gap-6">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-brand text-[13px] font-black text-canvas">
              B
            </span>
            <span className="text-[15px] font-bold tracking-tight text-ink">BuzzTook</span>
          </Link>

          <nav className="flex min-w-0 items-center gap-1 overflow-x-auto text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="whitespace-nowrap rounded-md px-2.5 py-1.5 text-ink-muted transition-colors hover:bg-surface-2 hover:text-ink sm:px-3"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex shrink-0 items-center gap-3 text-[11px] text-ink-faint">
            <span className="hidden tabular xl:inline">
              model {MODEL_VERSION} / {SCORING_VERSION}
            </span>
            <span className="hidden rounded border border-line px-1.5 py-0.5 lg:inline">
              DB: {repository.driver === "prisma" ? "PostgreSQL" : "ローカルJSON"}
            </span>
            <span className="hidden text-ink-muted sm:inline">{user?.name ?? "ユーザー"}</span>
            <form action={signOutAction}>
              <button
                type="submit"
                className="whitespace-nowrap rounded-md px-2 py-1 text-ink-faint transition-colors hover:bg-surface-2 hover:text-ink"
              >
                ログアウト
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-8">{children}</main>

      <footer className="border-t border-line px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-faint">
          <span>BuzzTook Ver.1（Phase 1-2：UIプロトタイプ ＋ 台本分析MVP）</span>
          <span>完成動画分析は Phase 3、TikTok連携は Phase 4 で実装予定</span>
        </div>
      </footer>
    </div>
  );
}
