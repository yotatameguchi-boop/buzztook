# デプロイ手順（クローズドデモ）

想定構成：**Vercel（アプリ） + Neon（PostgreSQL）**。
Supabase や Railway でも `DATABASE_URL` を差し替えるだけで動きます。

---

## 0. 事前確認

このアプリは本番で `DATABASE_URL` が未設定の場合、**起動時に明示的にエラーを出して停止します**。
ローカル開発用のJSONストアにフォールバックしてデータを失うことを防ぐためです。

---

## 1. PostgreSQL を用意する

Neon（https://neon.tech）でプロジェクトを作成し、接続文字列を取得します。

```
postgresql://<user>:<password>@<host>/<db>?sslmode=require
```

> Neon の場合、Vercel との接続はプーラー経由（ホスト名に `-pooler` が付くもの）を使ってください。
> サーバーレス環境では接続数が増えやすいためです。

## 2. マイグレーションを本番DBに適用する

ローカルから一度だけ実行します。

```bash
DATABASE_URL="<本番の接続文字列>" npm run db:deploy
```

`prisma migrate deploy` は `prisma/migrations/` にあるマイグレーションを適用するだけで、
スキーマの差分から新しいマイグレーションを作ることはありません（本番で安全な方のコマンドです）。

## 3. Vercel にデプロイする

GitHub リポジトリを Vercel に接続し、以下の環境変数を設定します。

| 変数 | 値 | 必須 |
| --- | --- | --- |
| `DATABASE_URL` | 手順1の接続文字列 | ✅ |
| `AUTH_SECRET` | 下記コマンドで新規生成（**ローカルのものを流用しない**） | ✅ |
| `INVITE_CODE` | 招待コード。クローズドデモでは必ず設定する | 推奨 |
| `AUTH_URL` | 独自ドメインを使う場合のみ（Vercelでは通常不要） | — |

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

ビルド設定はデフォルトのままで動きます（`postinstall` で `prisma generate` が走ります）。

## 4. デプロイ後の確認

```bash
# 未ログインでAPIを叩くと401が返ること
curl -s -o /dev/null -w "%{http_code}\n" https://<your-domain>/api/projects

# 未ログインで画面を開くと /login にリダイレクトされること
curl -s -o /dev/null -w "%{http_code} -> %{redirect_url}\n" https://<your-domain>/
```

その後、`/signup` から招待コード付きで登録し、台本を1本分析できることを確認します。

## 5. デモ用アカウントの掃除

ローカル検証で作った `demo@buzztook.dev` は本番DBには存在しませんが、
もし本番で作った検証用アカウントがあれば削除してください。

```sql
delete from users where email = '<検証用アドレス>';
```

---

## 既知の制約（クローズドデモを超える場合に必要な対応）

| 項目 | 現状 | 対応が必要になる時期 |
| --- | --- | --- |
| ログイン試行回数の制限 | なし。招待コードで入口を絞っている前提 | 一般公開する時 |
| パスワードリセット | なし | ユーザーが増えた時 |
| メールアドレス確認 | なし | 一般公開する時 |
| 監査ログ | なし | 事務所・チーム利用を始める時 |
| バックアップ | ホスティング側の機能に依存 | 実データが入った時点で即 |

ログイン試行回数の制限をサーバーレスで正しく行うには、インスタンス間で共有される
ストア（Upstash Redis 等）が必要です。プロセス内カウンタでは意味がないため、
中途半端に実装せず未対応であることを明示しています。
