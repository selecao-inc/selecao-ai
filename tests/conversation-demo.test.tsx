import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ConversationDemo } from "@/components/ConversationDemo";
import { CONSULTATIONS } from "@/content/home";

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce, media: query }));
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const first = CONSULTATIONS[0];

function expectFirstAllDone() {
  expect(screen.getByText(first.q)).toBeTruthy();
  expect(screen.getByText(first.a)).toBeTruthy();
  expect(screen.getByText("公開しました")).toBeTruthy();
  expect(screen.getAllByText("✓")).toHaveLength(4);
}

test("reduced motion では1つ目の相談の全工程完了を見せ、時間が経っても変わらない", () => {
  vi.useFakeTimers();
  stubReducedMotion(true);
  render(<ConversationDemo />);
  expectFirstAllDone();
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
  expectFirstAllDone();
});

test("動かせる環境では入力の段階から再生が始まる", () => {
  vi.useFakeTimers();
  stubReducedMotion(false);
  render(<ConversationDemo />);
  act(() => {
    vi.advanceTimersByTime(70 * 3 + 40);
  });
  expect(screen.getByText([...first.q].slice(0, 3).join(""))).toBeTruthy();
  expect(screen.queryByText("公開しました")).toBeNull();
});
