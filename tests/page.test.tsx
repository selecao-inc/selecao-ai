import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import Home from "@/app/page";

beforeEach(() => {
  // jsdom には matchMedia が無い。会話デモは動かさない設定で描画する
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: true, media: query }));
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

test("見出し・各節・ダミーの注記が表示される", () => {
  render(<Home />);
  expect(screen.getByRole("heading", { level: 1, name: "AI で、何を変えますか？" })).toBeTruthy();
  for (const name of ["注目の事例", "サービス", "考えるところから、作るところまで一社で", "事例", "まずは、いまの状況を聞かせてください"]) {
    expect(screen.getByRole("heading", { level: 2, name })).toBeTruthy();
  }
  expect(screen.getByText("※ 事例・業種・日付はすべてダミーです")).toBeTruthy();
});

test("会話デモは1つの画像として伝わる", () => {
  render(<Home />);
  expect(screen.getByRole("img", { name: "相談と返信の例が自動で流れる画面" })).toBeTruthy();
});

test("フッターに4つのリンクがある", () => {
  render(<Home />);
  const footer = screen.getByRole("contentinfo");
  const links = within(footer).getAllByRole("link");
  expect(links.map((a) => [a.textContent, a.getAttribute("href")])).toEqual([
    ["トップ", "/"],
    ["サービス", "#services"],
    ["会社概要", "#about"],
    ["お問い合わせ", "#contact"],
  ]);
  expect(within(footer).getByText("© SELECAO Inc.")).toBeTruthy();
});
