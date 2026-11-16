"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, CONSULTATIONS, DEMO, STEPS } from "@/content/home";
import { STILL_STATE, demoStateAt, type DemoState } from "./conversation-timeline";

const TICK_MS = 40;

// 初期表示（サーバー描画・JS なし・reduced motion）は1つ目の相談の全工程完了。動かせる環境ではマウント後に再生を始める
export function ConversationDemo() {
  const [state, setState] = useState<DemoState>(STILL_STATE);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    // 再生中に設定が変わることもあるため、変更のたびに止めて静止表示へ戻すか、最初から再生し直す
    const apply = () => {
      clearInterval(timer);
      if (reduce.matches) {
        setState(STILL_STATE);
        return;
      }
      const start = Date.now();
      timer = setInterval(() => {
        const next = demoStateAt(CONSULTATIONS, Date.now() - start);
        // 変化がない tick では再描画しない
        setState((prev) =>
          prev.index === next.index && prev.phase === next.phase && prev.n === next.n ? prev : next,
        );
      }, TICK_MS);
    };
    apply();
    reduce.addEventListener("change", apply);
    return () => {
      reduce.removeEventListener("change", apply);
      clearInterval(timer);
    };
  }, []);

  const { index, phase, n } = state;
  const p = CONSULTATIONS[index];
  const typing = phase === "type";
  const input = typing ? [...p.q].slice(0, n).join("") : "";
  const answer = phase === "reply" ? [...p.a].slice(0, n).join("") : p.a;
  const showAnswer = phase === "reply" || phase === "flow" || phase === "hold";
  const showFlow = phase === "flow" || phase === "hold";

  return (
    <>
      <div
        role="img"
        aria-label={DEMO.label}
        className="box-border flex w-full max-w-[720px] flex-col gap-4 rounded-[28px] border border-line bg-surface p-6 shadow-[0_8px_32px_rgba(0,0,0,0.06)]"
      >
        {/* 高さを固定し、相談が入れ替わってもページが上下に動かないようにする */}
        <div
          aria-hidden="true"
          className="flex h-[340px] flex-col justify-end gap-4 overflow-hidden sp:h-[500px]"
        >
          {!typing && (
            <div className="max-w-[80%] self-end rounded-[20px] bg-sub px-[18px] py-2.5">{p.q}</div>
          )}
          {phase === "think" && (
            <div className="flex gap-1.5 px-0.5 py-2 text-[22px] leading-none">
              <span className="animate-dot">・</span>
              <span className="animate-dot [animation-delay:.2s]">・</span>
              <span className="animate-dot [animation-delay:.4s]">・</span>
            </div>
          )}
          {showAnswer && (
            <div className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-ink text-[11px] font-bold text-white">
                S
              </span>
              <p className="m-0 leading-[1.9] text-[#262626]">
                {answer}
                {phase === "reply" && (
                  <span className="ml-0.5 inline-block h-4 w-2 animate-caret bg-accent align-[-2px]" />
                )}
              </p>
            </div>
          )}
          {showFlow && (
            <div className="ml-10 flex flex-col gap-3 rounded-2xl border border-line px-4 py-3.5 sp:ml-0">
              <div className="flex justify-between gap-3 text-xs text-faint">
                <span>
                  {DEMO.flowPrefix}
                  {p.job}
                </span>
                <span>{phase === "hold" ? DEMO.flowDone : DEMO.flowRunning}</span>
              </div>
              <div className="grid grid-cols-4 gap-2.5 sp:grid-cols-2">
                {STEPS.map((s, k) => {
                  // flow 中は n = いま進んでいる工程の番号。hold では全工程を完了として見せる
                  const done = phase === "hold" || k < n;
                  const now = phase === "flow" && k === n;
                  return (
                    <div key={s.label} className={`flex items-start gap-2 ${done || now ? "" : "opacity-45"}`}>
                      <span
                        className={`mt-0.5 box-border size-[18px] shrink-0 rounded-full border-[1.5px] text-center text-[10px] leading-[15px] text-white ${
                          done ? "border-ink bg-ink" : now ? "animate-pulse-ring border-ink" : "border-[#D4D4D4]"
                        }`}
                      >
                        {done ? "✓" : ""}
                      </span>
                      <span className="flex min-w-0 flex-col">
                        <span className="text-[13px] leading-[1.6] font-medium">{s.label}</span>
                        <span className="text-[11px] leading-normal text-faint">{s.who}</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        <div
          aria-hidden="true"
          className="flex min-h-14 items-center gap-3 rounded-full border border-line py-0 pr-2 pl-5"
        >
          <div className="min-w-0 grow truncate">
            {input.length > 0 ? (
              <>
                <span>{input}</span>
                <span className="ml-0.5 inline-block h-[18px] w-px animate-caret bg-ink align-[-3px]" />
              </>
            ) : (
              <span className="text-faint">{DEMO.placeholder}</span>
            )}
          </div>
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-full text-white ${
              input.length > 0 ? "bg-accent" : "bg-[#D4D4D4]"
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M8 13V3M4 7l4-4 4 4" />
            </svg>
          </span>
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2.5">
        {CATEGORIES.map((label, k) => (
          <a
            key={label}
            href="#services"
            className={`inline-flex min-h-10 items-center rounded-full border px-[18px] text-sm ${
              k === p.cat ? "border-ink bg-ink text-white" : "border-line bg-surface text-[#404040]"
            }`}
          >
            {label}
          </a>
        ))}
      </div>
    </>
  );
}
