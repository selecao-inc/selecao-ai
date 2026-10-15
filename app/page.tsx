// 意図的な型エラー（Issue #4: CI が型エラーで失敗することの確認用。確認後に revert する）
export const ciTypeErrorCheck: number = "not a number";

export default function Home() {
  return (
    <main className="grid min-h-dvh place-content-center gap-2 p-4 text-center">
      <h1 className="text-2xl font-semibold">株式会社セレソン</h1>
      <p className="text-neutral-600 dark:text-neutral-400">ただいまサイトを準備中です。</p>
    </main>
  );
}
