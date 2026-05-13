import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Listening Cards",
  description: "真实英语听力闪卡：搜索真实发音，加入单词本，听写复习。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
