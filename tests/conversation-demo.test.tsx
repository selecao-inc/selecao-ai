import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { ConversationDemo } from "@/components/ConversationDemo";
import { CONSULTATIONS } from "@/content/home";

// 設定の変更を後から起こせるよう、change の購読も含めて matchMedia を差し替える
function stubReducedMotion(reduce: boolean) {
  const listeners = new Set<() => void>();
  const mq = {
    matches: reduce,
    media: "(prefers-reduced-motion: reduce)",
    addEventListener: (_: "change", fn: () => void) => listeners.add(fn),
    removeEventListener: (_: "change", fn: () => void) => listeners.delete(fn),
  };
  vi.stubGlobal("matchMedia", () => mq);
  return {
    listeners,
    set(next: boolean) {
      mq.matches = next;
      act(() => listeners.forEach((fn) => fn()));
    },
  };
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

function expectTypingStarted() {
  expect(screen.getByText([...first.q].slice(0, 3).join(""))).toBeTruthy();
  expect(screen.queryByText("公開しました")).toBeNull();
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
  expectTypingStarted();
});

test("再生中に reduced motion へ変えると止まって全工程完了に戻り、時間が経っても変わらない", () => {
  vi.useFakeTimers();
  const media = stubReducedMotion(false);
  render(<ConversationDemo />);
  act(() => {
    vi.advanceTimersByTime(70 * 3 + 40);
  });
  expectTypingStarted();
  media.set(true);
  expectFirstAllDone();
  act(() => {
    vi.advanceTimersByTime(60_000);
  });
  expectFirstAllDone();
});

test("reduced motion を解除すると入力の段階から再生する", () => {
  vi.useFakeTimers();
  const media = stubReducedMotion(true);
  render(<ConversationDemo />);
  act(() => {
    vi.advanceTimersByTime(10_000);
  });
  media.set(false);
  act(() => {
    vi.advanceTimersByTime(70 * 3 + 40);
  });
  expectTypingStarted();
});

test("アンマウントで設定の購読とタイマーを片付ける", () => {
  vi.useFakeTimers();
  const media = stubReducedMotion(false);
  const { unmount } = render(<ConversationDemo />);
  expect(media.listeners.size).toBe(1);
  unmount();
  expect(media.listeners.size).toBe(0);
  expect(vi.getTimerCount()).toBe(0);
});
