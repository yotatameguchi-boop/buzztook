/**
 * 永続化層のエントリポイント。
 *
 * DATABASE_URL が設定されていれば PostgreSQL(Prisma)、
 * 未設定ならローカル JSON ストアを使う。呼び出し側はどちらかを意識しない。
 */

import { JsonRepository } from "./json-repository";
import { PrismaRepository } from "./prisma-repository";
import type { Repository } from "./types";

let repository: Repository | null = null;

export function getRepository(): Repository {
  if (repository) return repository;

  // JSON ストアはローカル開発専用。サーバーレス環境ではファイルシステムが
  // インスタンスごとに独立し揮発するため、本番で使うとデータが黙って消える。
  // 「なぜか昨日の分析が無い」という壊れ方を防ぐため、起動時点で明示的に落とす。
  if (!process.env.DATABASE_URL && process.env.NODE_ENV === "production") {
    throw new Error(
      "本番環境では DATABASE_URL が必須です。ローカルJSONストアは開発専用のため使用できません。",
    );
  }

  // PrismaRepository は static import しているが、DB への接続は最初のクエリ時まで
  // 発生しない（PrismaClient の生成自体を遅延させている）。
  // そのため DATABASE_URL がない環境でも import 自体は安全。
  repository = process.env.DATABASE_URL ? new PrismaRepository() : new JsonRepository();

  return repository;
}

export type { Repository } from "./types";
export * from "./types";
