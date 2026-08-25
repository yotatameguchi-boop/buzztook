/**
 * 認証設定（Auth.js v5 / Credentials プロバイダ）。
 *
 * セッションは JWT 方式。DB にセッションテーブルを持たないため、
 * ミドルウェアや Edge ランタイムから DB 接続を必要としない。
 */

import { getRepository } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email("メールアドレスの形式が正しくありません"),
  password: z.string().min(8, "パスワードは8文字以上にしてください").max(200),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  // Vercel 以外のホスティングやリバースプロキシ配下でも、
  // コールバックURLをリクエストのホストから解決できるようにする。
  // 固定したい場合は AUTH_URL を設定する。
  trustHost: true,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "メールアドレス", type: "email" },
        password: { label: "パスワード", type: "password" },
      },
      async authorize(credentials) {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const user = await getRepository().findUserByEmail(parsed.data.email);
        // ユーザーが存在しない場合も、存在するがパスワードが違う場合と
        // 区別できないように同じ結果（null）を返す
        if (!user) return null;

        const valid = await verifyPassword(parsed.data.password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.sub = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      return session;
    },
  },
});
