/**
 * パスワードハッシュ。
 *
 * ネイティブ拡張（bcrypt 等）を避け、Node 標準の scrypt を使う。
 * 保存形式: scrypt$<N>$<saltBase64>$<hashBase64>
 */

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
) => Promise<Buffer>;

const KEY_LENGTH = 64;
const COST = 16384;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, KEY_LENGTH);
  return `scrypt$${COST}$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, , saltBase64, hashBase64] = stored.split("$");
  if (scheme !== "scrypt" || !saltBase64 || !hashBase64) return false;

  const salt = Buffer.from(saltBase64, "base64");
  const expected = Buffer.from(hashBase64, "base64");
  const derived = await scryptAsync(password, salt, expected.length);

  // 長さが違う場合 timingSafeEqual は例外を投げるため先に確認する
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}
