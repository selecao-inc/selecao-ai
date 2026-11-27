import { describe, expect, it } from "vitest";
import { lightOnly, selectScenarios, judgeReports, verifiedDeployment, deploymentOrigin,
  type Issue, type Scenario, type Report } from "@/.github/scripts/scenario-runner.mts";
import { bypassHeaders } from "@/tests/scenarios/preview.mts";
import type { GuardInput } from "@/.github/scripts/pr-guard.mts";

const pr: GuardInput = { repository: "selecao-inc/selecao-ai", author: "selecao-agents", branch: "x/issue-41-loader",
  body: "Closes #41", changedFiles: ["app/page.tsx"] };
const open = (n: number, over: Partial<Issue> = {}): Issue => ({ ok: true, number: n, state: "open", reason: null,
  isPullRequest: false, labels: [], body: "", ...over });
const scenario = (n: number): Scenario => ({ issue: n, file: `tests/scenarios/issue-${n}/a.scenario.test.ts`, engine: "vitest" });
const lookup = async (n: number) => open(n);

describe("差分だけで決める軽の例外", () => {
  it.each([
    [["content/a.ts", "docs/a.md"], true], [["docs/factory/verification.md"], false],
    [["docs/a.md", "app/page.tsx"], false], [[], false], [["contentious/a.ts"], false],
    [["docs/a.md", "tests/old.ts"], false],
  ])("%j", (paths, result) => expect(lightOnly(paths as string[])).toBe(result));
});

describe("Issue の状態とシナリオ対象", () => {
  it("実装対象だけを実行し、無関係の open は対象外", async () => {
    const p = await selectScenarios("sha", [scenario(41), scenario(42)], lookup, pr);
    expect(p.groups.map((g) => [g.issue, g.mode])).toEqual([[41, "pass"]]);
    expect(p.skipped).toEqual([expect.stringContaining("42")]);
  });
  it("main では completed の回帰だけ実行", async () => {
    const p = await selectScenarios("sha", [scenario(41), scenario(42)], async (n) => open(n,
      n === 42 ? { state: "closed", reason: "completed" } : {}));
    expect(p.groups.map((g) => [g.issue, g.mode])).toEqual([[42, "pass"]]);
  });
  it("シナリオ PR は対象の失敗と、完了済みの回帰成功を要求", async () => {
    const p = await selectScenarios("sha", [scenario(42), scenario(43)], async (n) => open(n,
      n === 41 ? { labels: ["scenario"], body: "シナリオ対象: #42" } :
        n === 43 ? { state: "closed", reason: "completed" } : {}), pr);
    expect(p.groups.map((g) => [g.issue, g.mode])).toEqual([[42, "fail"], [43, "pass"]]);
  });
  it.each(["not_planned", null, "unknown"])("completed 以外の closed（%s）は失敗", async (reason) => {
    await expect(selectScenarios("sha", [scenario(42)], async (n) => open(n, { state: "closed", reason }))).rejects.toThrow("削除");
  });
  it("API 取得失敗で fail closed", async () => {
    await expect(selectScenarios("sha", [scenario(42)], async () => { throw new Error("HTTP 404"); })).rejects.toThrow("404");
  });
  it("実装 PR の0件は失敗", async () => {
    await expect(selectScenarios("sha", [], lookup, pr)).rejects.toThrow("0件");
  });
  it("軽だけの0件例外でも completed の回帰は実行", async () => {
    const p = await selectScenarios("sha", [scenario(42)], async (n) => open(n,
      n === 42 ? { state: "closed", reason: "completed" } : {}), { ...pr, changedFiles: ["docs/a.md"] });
    expect(p.groups.map((g) => g.issue)).toEqual([42]);
    expect(p.skipped[0]).toContain("例外");
  });
  it("軽でもシナリオがある場合は実行", async () => {
    const p = await selectScenarios("sha", [scenario(41)], lookup, { ...pr, changedFiles: ["content/a.ts"] });
    expect(p.groups).toHaveLength(1);
  });
  it("scenario ラベルに0件例外はない", async () => {
    await expect(selectScenarios("sha", [], async (n) => open(n, { labels: ["scenario"], body: "シナリオ対象: #42" }),
      { ...pr, changedFiles: ["docs/a.md"] })).rejects.toThrow("0件");
  });
  it("factory は対象外", async () => {
    const p = await selectScenarios("sha", [], async (n) => open(n, { labels: ["factory"] }), pr);
    expect(p.exempt).toBe(true);
  });
  it("Dependabot は Issue 取得不要", async () => {
    const p = await selectScenarios("sha", [], async () => { throw new Error("呼ばれない"); },
      { ...pr, author: "dependabot[bot]", body: "" });
    expect(p.exempt).toBe(true);
  });
  it("実装・回帰は base のシナリオを使い、head の本文を信用しない", async () => {
    const p = await selectScenarios("sha", [], lookup, pr, { baseScenarios: [scenario(41)] });
    expect(p.groups[0].source).toBe("base");
    expect(p.groups[0].scenarios).toEqual([scenario(41)]);
  });
  it("completed の対象を変更するシナリオ PR は base の成功で通さない", async () => {
    await expect(selectScenarios("sha", [scenario(42)], async (n) => open(n, n === 41
      ? { labels: ["scenario"], body: "シナリオ対象: #42" }
      : { state: "closed", reason: "completed" }), pr, { baseScenarios: [scenario(42)] }))
      .rejects.toThrow("completed のシナリオは変更できません");
  });
  it("not_planned の対象を全削除するシナリオ PR だけは後片付け可能", async () => {
    const get = async (n: number) => open(n, n === 41 ? { labels: ["scenario"], body: "シナリオ対象: #42" } :
      { state: "closed", reason: "not_planned" });
    const deletion = { ...pr, changedFiles: [scenario(42).file] };
    const p = await selectScenarios("sha", [], get, deletion,
      { baseScenarios: [scenario(42)], removedFiles: [scenario(42).file] });
    expect(p.groups).toEqual([]);
    expect(p.skipped[0]).toContain("全削除");
    await expect(selectScenarios("sha", [], get, deletion, { baseScenarios: [scenario(42)], removedFiles: [] }))
      .rejects.toThrow();
    await expect(selectScenarios("sha", [scenario(42)], get, deletion,
      { baseScenarios: [scenario(42)], removedFiles: [scenario(42).file] })).rejects.toThrow("削除");
    await expect(selectScenarios("sha", [], get, { ...deletion, changedFiles: [scenario(42).file, "app/page.tsx"] },
      { baseScenarios: [scenario(42)], removedFiles: [scenario(42).file] })).rejects.toThrow();
  });
});

describe("実際の検査失敗だけを反転する", () => {
  const report = (status: Report["tests"][number]["status"]): Report => ({ complete: true, planned: 1, error: false, tests: [{ id: "a", status }] });
  it("成功は実装 PR のみ合格", () => {
    expect(judgeReports([{ report: report("passed"), exit: 0 }], "pass")).toBe(true);
    expect(judgeReports([{ report: report("passed"), exit: 0 }], "fail")).toBe(false);
  });
  it("検査失敗はシナリオ PR のみ合格", () => {
    expect(judgeReports([{ report: report("assertion"), exit: 1 }], "fail")).toBe(true);
    expect(judgeReports([{ report: report("assertion"), exit: 1 }], "pass")).toBe(false);
  });
  it.each(["error", "skipped"] as const)("%s は期待した失敗にしない", (status) => {
    expect(judgeReports([{ report: report(status), exit: 1 }], "fail")).toBe(false);
  });
  it.each([
    { ...report("assertion"), complete: false }, { ...report("assertion"), error: true },
    { ...report("assertion"), planned: 0, tests: [] }, { ...report("assertion"), planned: 2 },
    { ...report("assertion"), planned: 2, tests: [report("assertion").tests[0], report("assertion").tests[0]] },
  ])("欠落・起動エラー・0件・不完全・重複は不合格", (r) => {
    expect(judgeReports([{ report: r, exit: 1 }], "fail")).toBe(false);
  });
  it("exit signal/timeout や report と exit code の不一致は不合格", () => {
    expect(judgeReports([{ report: report("assertion"), exit: null }], "fail")).toBe(false);
    expect(judgeReports([{ report: report("assertion"), exit: 0 }], "fail")).toBe(false);
    expect(judgeReports([], "pass")).toBe(false);
  });
  it("一部の失敗で常時成功のテストを隠さない", () => {
    const mixed = { ...report("assertion"), planned: 2,
      tests: [report("assertion").tests[0], { id: "b", status: "passed" as const }] };
    expect(judgeReports([{ report: mixed, exit: 1 }], "fail")).toBe(false);
  });
});

describe("deployment と秘密 header の境界", () => {
  const d = { id: 1, sha: "sha", environment: "Preview", creator: { login: "vercel[bot]" } };
  const s = { state: "success", environment_url: "https://selecao-ai-abcd.vercel.app", creator: { login: "vercel[bot]" } };
  it("SHA・環境・成功・Vercel bot が一致するときのみ使用", () => {
    expect(verifiedDeployment(d, s, "sha", false)).toBe(s.environment_url);
    expect(verifiedDeployment(d, s, "new-sha", false)).toBeNull();
    expect(verifiedDeployment(d, s, "sha", true)).toBeNull();
    expect(verifiedDeployment(d, { ...s, state: "failure" }, "sha", false)).toBeNull();
    expect(verifiedDeployment({ ...d, creator: { login: "attacker" } }, s, "sha", false)).toBeNull();
  });
  it.each(["http://x.vercel.app", "https://x.vercel.app.evil.test", "https://evil.test", "https://x.vercel.app/?token=x",
    "https://a:b@x.vercel.app", "https://x.vercel.app/path"])("不正 URL %s を拒否", (url) => expect(() => deploymentOrigin(url)).toThrow());
  it("検証済み origin にだけ付与し、別 origin では既存 header も除去", () => {
    const origin = s.environment_url;
    expect(bypassHeaders(`${origin}/a`, origin, {}, "test-secret")).toEqual({ "x-vercel-protection-bypass": "test-secret" });
    expect(bypassHeaders("https://other.vercel.app", origin, { "X-Vercel-Protection-Bypass": "test-secret", accept: "text/html" }, "test-secret"))
      .toEqual({ accept: "text/html" });
  });
});
