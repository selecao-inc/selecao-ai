// @vitest-environment node
import { afterAll, describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, symlinkSync, copyFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { judgeReports, type Report } from "@/.github/scripts/scenario-runner.mts";

mkdirSync(".scenario-work", { recursive: true });
const root = mkdtempSync(resolve(".scenario-work/reporter-fixtures-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
const harness = process.cwd();

function fixture(engine: "vitest" | "preview", name: string, code: string) {
  const dir = resolve(root, `${engine}-${name}`);
  const scenarios = resolve(dir, "tests/scenarios");
  mkdirSync(resolve(scenarios, "issue-99999"), { recursive: true });
  symlinkSync(resolve(harness, "node_modules"), resolve(dir, "node_modules"), "dir");
  writeFileSync(resolve(dir, "package.json"), '{"type":"module"}');
  for (const file of [`${engine}.config.mts`, `${engine}-reporter.mts`]) {
    copyFileSync(resolve(harness, "tests/scenarios", file), resolve(scenarios, file));
  }
  const file = resolve(scenarios, `issue-99999/a.scenario.${engine === "vitest" ? "test" : "spec"}.ts`);
  writeFileSync(file, `import { test, expect } from '${engine === "vitest" ? "vitest" : "@playwright/test"}';\n${code}`);
  const output = resolve(dir, "report.json");
  const result = spawnSync(resolve(harness, `node_modules/.bin/${engine === "vitest" ? "vitest" : "playwright"}`),
    [engine === "vitest" ? "run" : "test", "--config", resolve(scenarios, `${engine}.config.mts`)],
    { cwd: dir, env: { ...process.env, SCENARIO_REPORT: output }, encoding: "utf8", timeout: 30_000 });
  const report = JSON.parse(readFileSync(output, "utf8")) as Report;
  return { report, exit: result.status };
}

describe.each(["vitest", "preview"] as const)("%s の実 reporter", (engine) => {
  it("成功をシナリオ PR の合格に反転しない", () => {
    const r = fixture(engine, "success", "test('ok', () => { expect(1).toBe(1); });");
    expect(r.exit).toBe(0);
    expect(judgeReports([r], "pass")).toBe(true);
    expect(judgeReports([r], "fail")).toBe(false);
  }, 40_000);
  it("expect の実際の失敗だけを合格に反転", () => {
    const r = fixture(engine, "assertion", "test('wrong', () => { expect(1).toBe(2); });");
    expect(r.exit).toBe(1);
    expect(r.report.tests.map((t) => t.status)).toEqual(["assertion"]);
    expect(judgeReports([r], "fail")).toBe(true);
  }, 40_000);
  it("起動時エラーを期待した失敗にしない", () => {
    const r = fixture(engine, "startup", "throw new Error('startup failure');");
    expect(judgeReports([r], "fail")).toBe(false);
  }, 40_000);
  it("runtime error を期待した失敗にしない", () => {
    const r = fixture(engine, "runtime", "test('error', () => { throw new Error('runtime failure'); });");
    expect(r.report.tests.map((t) => t.status)).toEqual(["error"]);
    expect(judgeReports([r], "fail")).toBe(false);
  }, 40_000);
  it("skip のみを合格にしない", () => {
    const r = fixture(engine, "skip", "test.skip('skip', () => {});");
    expect(judgeReports([r], "fail")).toBe(false);
    expect(judgeReports([r], "pass")).toBe(false);
  }, 40_000);
  it("timeout を期待した失敗にしない", () => {
    const r = fixture(engine, "timeout", engine === "vitest"
      ? "test('timeout', async () => { await new Promise(() => {}); }, 50);"
      : "test('timeout', async ({}, info) => { info.setTimeout(50); await new Promise(() => {}); });");
    expect(judgeReports([r], "fail")).toBe(false);
  }, 40_000);
  it("0件を期待した失敗にしない", () => {
    const r = fixture(engine, "empty", "");
    expect(r.report.planned).toBe(0);
    expect(judgeReports([r], "fail")).toBe(false);
  }, 40_000);
});
