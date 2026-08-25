/**
 * サーバー起動時に一度だけ走る初期化フック。
 *
 * 本番で必須の環境変数を「起動時点で」検証する。
 * リポジトリ層にもガードはあるが、そちらはDBに触れて初めて発火するため、
 * 設定漏れに気付くのがユーザーのログイン後になってしまう。
 * 壊れた状態のまま起動しないよう、ここで落とす。
 */
export async function register() {
  // Edge ランタイム側では環境変数の扱いが異なるため、Node 側でのみ検証する
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.NODE_ENV !== "production") return;

  const required = ["DATABASE_URL", "AUTH_SECRET"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `本番環境で必須の環境変数が設定されていません: ${missing.join(", ")}\n` +
        "設定方法は docs/deployment.md を参照してください。",
    );
  }
}
