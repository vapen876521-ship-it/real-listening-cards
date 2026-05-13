import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Real Listening Cards",
  description: "Search real English pronunciations and save them as listening flashcards."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
