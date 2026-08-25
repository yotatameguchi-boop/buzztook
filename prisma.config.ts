import { existsSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "prisma/config";

/**
 * Prisma 7 では接続 URL を schema.prisma ではなくここで指定する。
 * また .env の自動読み込みも行われないため、Node 標準の loadEnvFile で明示的に読む。
 * （Next.js 側は .env を自動で読むので、この処理は Prisma CLI のためだけのもの）
 */
const envFile = path.join(process.cwd(), ".env");
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    // DATABASE_URL 未設定でも `prisma generate` を通すため空文字にフォールバックする。
    // migrate / db push を使うときは .env に DATABASE_URL を設定すること。
    url: process.env.DATABASE_URL ?? "",
  },
});
