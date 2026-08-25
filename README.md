# BuzzTook

TikTokコンテンツの「台本上のポテンシャル」と「完成動画での実現度」を二段階で分析する、コンテンツ分析プラットフォーム。

このリポジトリは仕様書 Ver.1.0 の **Phase 1（UIプロトタイプ）＋ Phase 2（台本分析MVP）** の実装です。

## クイックスタート

```bash
npm install
cp .env.example .env
```

`.env` に最低限 `AUTH_SECRET` を設定します（生成コマンドは `.env.example` に記載）。
`DATABASE_URL` は未設定でも動きます（その場合はローカルJSONストアを使用）。

```bash
npm run dev
```

http://localhost:3000 を開き、`/signup` からユーザー登録してください。

サンプルデータを入れる場合は、登録したアカウントの資格情報を渡して実行します:

```bash
SEED_EMAIL=you@example.com SEED_PASSWORD=yourpassword npm run seed
```

意図的に弱い台本（v1）と改善版（v2）が投入され、バージョン比較画面で差分を確認できます。

## 実装済みの機能

| # | 機能 | 場所 |
| --- | --- | --- |
| 1 | プロジェクト一覧ダッシュボード | `/` |
| 2 | 新規分析作成（タイトル・ジャンル・ターゲット・想定尺・アカウント） | `/projects/new` |
| 3 | 台本入力（文字数・推定尺のリアルタイム表示） | `/projects/[id]/script` |
| 4 | 台本分析結果 | `/projects/[id]/analyses/[analysisId]` |
| 5 | 10項目のスコアと根拠の開示 | 同上 |
| 6 | 10項目を5軸に集約した独自の菱形チャート | `src/components/charts/diamond-chart.tsx` |
| 7 | 総合バズポテンシャルの「上位◯%」表示 | 同上 |
| 8 | 強み・弱み・改善提案（DATA INSIGHT / AI SUGGESTION の区別） | 同上 |
| 9 | 台本のバージョン管理と修正前後の比較 | `/projects/[id]/compare` |
| 10 | 完成動画分析・TikTok連携の拡張余地 | `/projects/[id]/video`（Phase 3 の枠のみ） |

## 認証とデータの分離

メールアドレス＋パスワードによる認証（Auth.js v5 / Credentials、セッションはJWT）。
パスワードは Node 標準の scrypt でハッシュ化しています（ネイティブ拡張なし）。

`INVITE_CODE` を設定すると新規登録が招待制になります。クローズドデモではこれを使ってください。

**プロジェクト・台本・分析結果は、登録したユーザー本人にしか見えません。**
リポジトリ層のメソッドはすべて `userId` を必須引数として受け取り、所有者以外には `null` を返します。
画面側のガード（`(app)/layout.tsx`）だけに頼らず、データ取得の時点でスコープする二重構造です。

検証済みの挙動:

| 操作 | 結果 |
| --- | --- |
| 未ログインで画面にアクセス | `/login` へリダイレクト |
| 未ログインでAPIを呼ぶ | 401 |
| 他ユーザーのプロジェクト一覧 | 0件 |
| 他ユーザーのプロジェクト詳細を直接URLで開く | 404 |
| 他ユーザーのプロジェクトに台本を追加 | 404 |

## 設計上の約束

仕様書 §22 の実装原則に対応します。

1. **スコアとパーセンタイルを分離する** — 内部は `rawScore` / `normalizedScore` / `percentile` / `confidence` を保持し、UI は「上位◯%」を優先表示する。
2. **AI提案とデータ根拠を分離する** — 改善提案は `DATA_INSIGHT` と `AI_SUGGESTION` にラベル付けされ、前者には必ず根拠の数値が付く。
3. **モデルバージョンを保存する** — すべての分析結果に `model_version` / `scoring_version` を保存する。異なるバージョン同士を比較すると警告が出る。
4. **信頼度を表示する** — データが少ない項目は HIGH/MEDIUM/LOW で明示し、断定しない。

また、**分析エンジンは乱数を使いません。** 同じ台本・同じ条件なら常に同じ結果を返します。

## アーキテクチャ

```
Next.js (App Router)
  ├─ app/                      画面・API Routes・Server Actions
  ├─ lib/services/             アプリケーションサービス層
  ├─ lib/analysis/             Script Analysis Service（差し替え対象）
  │    ├─ features.ts          Feature Extraction Service
  │    ├─ scoring.ts           Scoring Service（ジャンル別重み・各種補正）
  │    ├─ percentile.ts        Percentile Service（比較母集団）
  │    ├─ axes.ts              10項目 → 表示用5軸
  │    ├─ recommendations.ts   Recommendation Service
  │    └─ version.ts           model_version / scoring_version
  └─ lib/db/                   永続化層（Prisma / JSON の2実装）
```

分析ロジックの差し替え口は `src/lib/analysis/index.ts` の `getScriptAnalyzer()` 1箇所です。
FastAPI の分析サービスや LLM ベースの実装に切り替えるときは、`ScriptAnalyzer` インターフェースを満たす実装を返すだけで済みます。

分析エンジンの詳細は [docs/scoring-model.md](docs/scoring-model.md) を参照してください。

## データベース

仕様書 §15 のスキーマを `prisma/schema.prisma`（PostgreSQL）に定義しています。

このリポジトリは **PostgreSQL がなくても動きます**。`DATABASE_URL` の有無で永続化層が切り替わります。

| 条件 | 使われる実装 | 保存先 |
| --- | --- | --- |
| `DATABASE_URL` 未設定 | `JsonRepository` | `.data/buzztook.json` |
| `DATABASE_URL` 設定済み | `PrismaRepository` | PostgreSQL |

PostgreSQL に切り替える手順:

```bash
cp .env.example .env      # DATABASE_URL と AUTH_SECRET を設定
npm run db:generate
npm run db:migrate        # 初回は init マイグレーションが適用されます
npm run dev
```

macOS でローカルに用意する場合:

```bash
brew install postgresql@17 && brew services start postgresql@17 && createdb buzztook
```

画面右上に現在どちらを使っているかが表示されます。

> JSON ストアはローカル開発専用です。複数プロセスからの同時書き込みやマイグレーションには対応していません。本番では必ず PostgreSQL を使ってください。

## API（仕様書 §16）

| メソッド | パス | 状態 |
| --- | --- | --- |
| GET / POST | `/api/projects` | 実装済み |
| POST | `/api/projects/:id/scripts` | 実装済み |
| POST | `/api/scripts/:id/analyze` | 実装済み |
| GET / POST | `/api/accounts` | 実装済み |
| GET / POST | `/api/auth/*` | 実装済み（Auth.js） |
| POST | `/api/projects/:id/videos` | Phase 3（501 を返す） |
| GET | `/api/projects/:id/comparison` | Phase 3（501 を返す） |
| POST | `/api/projects/:id/results/sync` | Phase 4（501 を返す） |

`POST /api/scripts/:id/analyze` のレスポンス例:

```json
{
  "overall_percentile": 78,
  "overall_score": 59.8,
  "confidence": "MEDIUM",
  "scores": { "hook": 66.3, "curiosity": 50.4, "...": 0 },
  "display_axes": { "attraction": 58.3, "resonance": 34.5, "...": 0 },
  "improvements": [],
  "model_version": "rule-v1.1.0",
  "scoring_version": "score-v1.1.0"
}
```

`overall_percentile: 78` は「上位22%」を意味します（仕様書 §16 の注意書き）。

## 現時点の制約

- **「上位◯%」の絶対値は目安です。** パーセンタイルの参照分布は実データではなく想定値のため、意味があるのは同一条件での相対比較（修正前後の差分）です。
- パスワードリセット、メール確認、二要素認証は未実装です。クローズドデモの範囲を超える場合は追加が必要です。
- 組織（`organizations`）によるチーム共有は未実装です。現状は個人単位のみです。
- 完成動画分析（Phase 3）、TikTok連携（Phase 4）、学習型スコアリング（Phase 5）は未実装です。該当箇所には `TODO(Phase N)` コメントを入れてあります。

```bash
grep -rn "TODO(Phase" src/ prisma/
```

## デプロイ

Vercel + Neon での手順は [docs/deployment.md](docs/deployment.md) を参照してください。

本番環境で `DATABASE_URL` が未設定の場合、アプリは起動時にエラーで停止します。
ローカル開発用のJSONストアに気付かずフォールバックしてデータを失うことを防ぐためです。

## コマンド

| コマンド | 内容 |
| --- | --- |
| `npm run dev` | 開発サーバー |
| `npm run build` | 本番ビルド |
| `npm run seed` | サンプルデータ投入（要：開発サーバー起動＋SEED_EMAIL/SEED_PASSWORD） |
| `npm run typecheck` | 型チェック |
| `npm run lint` | ESLint |
| `npm run db:generate` | Prisma Client 生成 |
| `npm run db:push` | スキーマを DB に反映（開発用） |
| `npm run db:deploy` | 既存マイグレーションを適用（本番用） |

## 技術スタック

Next.js 16 (App Router) / TypeScript / Tailwind CSS v4 / Auth.js v5 / Prisma 7 + PostgreSQL / Zod
