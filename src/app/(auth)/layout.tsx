import Link from "next/link";

/** ログイン・新規登録画面の共通レイアウト（未ログインでも表示される）。 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <Link href="/login" className="mb-8 flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand text-base font-black text-canvas">
          B
        </span>
        <span className="text-lg font-bold tracking-tight text-ink">BuzzTook</span>
      </Link>

      <div className="w-full max-w-sm">{children}</div>

      <p className="mt-8 max-w-sm text-center text-[11px] leading-relaxed text-ink-faint">
        投稿前の台本を扱うため、プロジェクトは登録したユーザー本人にのみ表示されます。
      </p>
    </div>
  );
}
