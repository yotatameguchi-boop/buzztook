import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BuzzTook｜TikTokコンテンツ分析プラットフォーム",
  description:
    "台本上のポテンシャルと完成動画での実現度を二段階で分析する、TikTokコンテンツ分析プラットフォーム。",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
