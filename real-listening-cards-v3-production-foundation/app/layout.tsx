import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Listening Cards",
  description: "Reliable dictionary info and real pronunciation samples."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
