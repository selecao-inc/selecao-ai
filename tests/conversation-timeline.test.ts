import { describe, expect, test } from "vitest";
import { TIMING, demoStateAt, patternDuration, phaseAt } from "@/components/conversation-timeline";

// 長さが分かりやすい相談（q は 3文字、a は 4文字）
const p = { q: "あいう", a: "かきくけ" };
const typeEnd = 3 * 70 + 700; // 910
const thinkEnd = typeEnd + 1200; // 2110
const replyEnd = thinkEnd + 4 * 30; // 2230
const flowEnd = replyEnd + 4 * 1100; // 6630
const holdEnd = flowEnd + 4500; // 11130

describe("phaseAt", () => {
  test("時間の定数が Issue の表と一致する", () => {
    expect(TIMING).toEqual({ typePerChar: 70, typeAfter: 700, think: 1200, replyPerChar: 30, flowPerStep: 1100, hold: 4500 });
    expect(patternDuration(p)).toBe(holdEnd);
  });

  test.each([
    [0, "type", 0],
    [69, "type", 0],
    [70, "type", 1],
    [210, "type", 3], // 打ち終わり
    [typeEnd - 1, "type", 3], // 打ち終わって 700ms は全文のまま
    [typeEnd, "think", 0],
    [thinkEnd - 1, "think", 0],
    [thinkEnd, "reply", 0],
    [thinkEnd + 30, "reply", 1],
    [replyEnd - 1, "reply", 3],
    [replyEnd, "flow", 0],
    [replyEnd + 1100, "flow", 1],
    [replyEnd + 3300, "flow", 3],
    [flowEnd - 1, "flow", 3],
    [flowEnd, "hold", 0],
    [holdEnd - 1, "hold", 0],
  ] as const)("%i ms → %s（%i）", (ms, phase, n) => {
    expect(phaseAt(p, ms)).toEqual({ phase, n });
  });
});

describe("demoStateAt", () => {
  const q = { q: "えお", a: "さし" };

  test("最後まで進むと次の相談の入力に移る", () => {
    expect(demoStateAt([p, q], holdEnd - 1)).toEqual({ index: 0, phase: "hold", n: 0 });
    expect(demoStateAt([p, q], holdEnd)).toEqual({ index: 1, phase: "type", n: 0 });
    expect(demoStateAt([p, q], holdEnd + 70)).toEqual({ index: 1, phase: "type", n: 1 });
  });

  test("最後の相談の後は最初に戻る", () => {
    const total = patternDuration(p) + patternDuration(q);
    expect(demoStateAt([p, q], total - 1)).toEqual({ index: 1, phase: "hold", n: 0 });
    expect(demoStateAt([p, q], total)).toEqual({ index: 0, phase: "type", n: 0 });
  });
});
