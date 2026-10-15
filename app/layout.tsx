import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "株式会社セレソン",
  description: "株式会社セレソンのコーポレートサイト",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja">
      <body className="min-h-dvh bg-white text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
        {children}
      </body>
    </html>
  );
}
