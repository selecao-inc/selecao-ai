// 会話デモの段階の進み方。画面から切り離し、経過時間だけから表示状態を決める（テストしやすくするため）

export type Phase = "type" | "think" | "reply" | "flow" | "hold";

export type DemoState = {
  /** 表示中の相談の番号 */
  index: number;
  phase: Phase;
  /** type・reply では表示する文字数、flow ではいま進んでいる工程の番号。think・hold では 0 */
  n: number;
};

type Pattern = { q: string; a: string };

// 各段階の時間（Issue #37 の表のとおり）
export const TIMING = {
  typePerChar: 70,
  typeAfter: 700,
  think: 1200,
  replyPerChar: 30,
  flowPerStep: 1100,
  hold: 4500,
} as const;

export const STEP_COUNT = 4;

/** 1つの相談の、各段階の長さ（ms） */
function durations(p: Pattern): [Phase, number][] {
  // 文字数は見た目の文字（サロゲートペア含む）で数える
  return [
    ["type", [...p.q].length * TIMING.typePerChar + TIMING.typeAfter],
    ["think", TIMING.think],
    ["reply", [...p.a].length * TIMING.replyPerChar],
    ["flow", STEP_COUNT * TIMING.flowPerStep],
    ["hold", TIMING.hold],
  ];
}

export function patternDuration(p: Pattern): number {
  return durations(p).reduce((sum, [, d]) => sum + d, 0);
}

/** 1つの相談の中での経過時間から、段階と文字数（工程の番号）を返す。全体の長さ以上は hold のまま */
export function phaseAt(p: Pattern, elapsedMs: number): { phase: Phase; n: number } {
  let t = Math.max(0, elapsedMs);
  for (const [phase, d] of durations(p)) {
    if (t < d) {
      switch (phase) {
        case "type":
          return { phase, n: Math.min([...p.q].length, Math.floor(t / TIMING.typePerChar)) };
        case "reply":
          return { phase, n: Math.floor(t / TIMING.replyPerChar) };
        case "flow":
          return { phase, n: Math.floor(t / TIMING.flowPerStep) };
        default:
          return { phase, n: 0 };
      }
    }
    t -= d;
  }
  return { phase: "hold", n: 0 };
}

/** 開始からの経過時間から、どの相談のどの段階かを返す。最後の相談の後は最初に戻ってループする */
export function demoStateAt(patterns: readonly Pattern[], elapsedMs: number): DemoState {
  const total = patterns.reduce((sum, p) => sum + patternDuration(p), 0);
  let t = Math.max(0, elapsedMs) % total;
  for (let index = 0; index < patterns.length; index++) {
    const d = patternDuration(patterns[index]);
    if (t < d) return { index, ...phaseAt(patterns[index], t) };
    t -= d;
  }
  // 浮動小数の誤差などで抜けた場合の保険。最後の相談の表示段階にする
  return { index: patterns.length - 1, phase: "hold", n: 0 };
}

/** prefers-reduced-motion のときに見せる固定の状態（1つ目の相談の全工程完了） */
export const STILL_STATE: DemoState = { index: 0, phase: "hold", n: 0 };
