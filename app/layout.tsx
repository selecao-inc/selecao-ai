import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "株式会社セレソン",
  description: "株式会社セレソンのコーポレートサイト",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
