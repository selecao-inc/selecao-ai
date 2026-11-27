import { describe, expect, it, vi } from "vitest";
import { mkdtemp, mkdir, writeFile, symlink, rm } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { lightOnly, selectScenarios, judgeReports, verifiedDeployment, deploymentOrigin,
  sanctuaryOnly, SANCTUARY_PATHS, judgeGroup, discover, findDeployment, ApiError, RunFailure, runFailureMessage,
  type Issue, type Scenario, type Report, type Group, type Result } from "@/.github/scripts/scenario-runner.mts";
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
  it("factory は聖域だけの場合に対象 Issue を免除", async () => {
    const p = await selectScenarios("sha", [], async (n) => open(n, { labels: ["factory"] }),
      { ...pr, changedFiles: [".github/workflows/scenarios.yml", "docs/factory/verification.md"] });
    expect(p.targetExempt).toBe(true);
  });
  it("Dependabot は Issue 取得不要", async () => {
    const p = await selectScenarios("sha", [], async () => { throw new Error("呼ばれない"); },
      { ...pr, author: "dependabot[bot]", body: "" });
    expect(p.targetExempt).toBe(true);
  });
  it("factory + app/ は0件で失敗し、シナリオがあれば実装と同じ全件成功を要求", async () => {
    const input = { ...pr, changedFiles: [".github/workflows/scenarios.yml", "app/page.tsx"] };
    const get = async (n: number) => open(n, { labels: ["factory"] });
    await expect(selectScenarios("sha", [], get, input)).rejects.toThrow("0件");
    const p = await selectScenarios("sha", [scenario(41)], get, input);
    expect(p.targetExempt).toBe(false);
    expect(p.groups.map((g) => [g.issue, g.mode])).toEqual([[41, "pass"]]);
  });
  it.each(["factory", "dependabot"])("%s でも両エンジンの completed 回帰を保持", async (kind) => {
    const regressions: Scenario[] = [scenario(42), { ...scenario(42), file: "tests/scenarios/issue-42/a.scenario.spec.ts", engine: "preview" }];
    const get = async (n: number) => open(n, n === 41 ? { labels: ["factory"] } : { state: "closed", reason: "completed" });
    const p = await selectScenarios("sha", regressions, get, kind === "factory"
      ? { ...pr, changedFiles: ["infra/github.tf"] }
      : { ...pr, author: "dependabot[bot]", body: "", branch: "dependabot/test" });
    expect(p.targetExempt).toBe(true);
    expect(p.groups).toEqual([{ issue: 42, mode: "pass", source: "base", scenarios: regressions }]);
  });
  it("open のシナリオ PR では対象だけ head に差し替える", async () => {
    const old = scenario(42);
    const next = { ...old, file: "tests/scenarios/issue-42/new.scenario.test.ts" };
    const p = await selectScenarios("sha", [next], async (n) => open(n, n === 41
      ? { labels: ["scenario"], body: "シナリオ対象: #42" } : {}), pr, { baseScenarios: [old] });
    expect(p.groups).toEqual([{ issue: 42, mode: "fail", source: "head", scenarios: [next] }]);
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

describe("factory の聖域と CODEOWNERS", () => {
  it("判定に使う全パスが CODEOWNERS の対象と一致", () => {
    const paths = readFileSync(".github/CODEOWNERS", "utf8").trim().split("\n")
      .filter((line) => line && !line.startsWith("#")).map((line) => line.split(/\s+/)[0].slice(1));
    expect([...SANCTUARY_PATHS].sort()).toEqual(paths.sort());
  });
  it.each([
    [[".github/a", "tests/scenarios/issue-1/a.scenario.test.ts", "infra/main.tf", "docs/factory/a.md", "AGENTS.md", "vitest.config.mts"], true],
    [[".github/a", "app/a.ts"], false], [["docs/RUNBOOK.md"], false], [["package.json"], false],
    [["infra-old/a"], false], [["AGENTS.md.bak"], false], [[], false],
    [["docs/a.md", "docs/factory/old.md"], false],
  ])("%j", (paths, result) => expect(sanctuaryOnly(paths as string[])).toBe(result));
});

describe("engine ごとの report 完備", () => {
  const group: Group = { issue: 1, mode: "pass", source: "base", scenarios: [scenario(1), { ...scenario(1), engine: "preview" }] };
  const result = (engine: Result["engine"]): Result => ({ issue: 1, engine, exit: 0,
    report: { complete: true, error: false, planned: 1, tests: [{ id: engine, status: "passed" }] } });
  it("両 engine を要求し、片方欠落・重複を拒否", () => {
    expect(judgeGroup(group, [result("vitest"), result("preview")])).toBe(true);
    expect(judgeGroup(group, [result("vitest")])).toBe(false);
    expect(judgeGroup(group, [result("vitest"), result("vitest")])).toBe(false);
    expect(judgeGroup(group, [result("vitest"), { ...result("preview"), issue: 2 }])).toBe(false);
  });
});

describe("discover の fail closed", () => {
  async function fixture(run: (root: string, dir: string) => Promise<void>) {
    const root = await mkdtemp(resolve(tmpdir(), "scenario-discovery-"));
    const dir = resolve(root, "tests/scenarios/issue-1");
    await mkdir(dir, { recursive: true });
    try { await run(root, dir); } finally { await rm(root, { recursive: true, force: true }); }
  }
  it("正規のシナリオと補助ファイルを区別", async () => {
    await fixture(async (root, dir) => {
      await writeFile(resolve(dir, "a.scenario.test.ts"), "");
      await writeFile(resolve(dir, "helper.ts"), "");
      expect((await discover(root)).map((s) => s.file)).toEqual(["tests/scenarios/issue-1/a.scenario.test.ts"]);
    });
  });
  it.each(["a.scenario.test.tsx", "a.spec.ts", "a.test.js", "a.scenario.txt", "nested/a.scenario.spec.jsx"])("%s を黙って除外しない", async (name) => {
    await fixture(async (root, dir) => {
      await mkdir(resolve(dir, "nested"), { recursive: true });
      await writeFile(resolve(dir, "valid.scenario.test.ts"), "");
      await writeFile(resolve(dir, name), "");
      await expect(discover(root)).rejects.toThrow("命名規則");
    });
  });
  it("個別ファイル・issue ディレクトリ・scenarios 自体の symlink を拒否", async () => {
    for (const location of ["file", "issue", "root"] as const) {
      await fixture(async (root, dir) => {
        const destination = location === "file" ? resolve(dir, "a.scenario.test.ts") : location === "issue"
          ? resolve(root, "tests/scenarios/issue-2") : resolve(root, "tests/scenarios");
        if (location === "root") await rm(destination, { recursive: true });
        await symlink(resolve(root, "other"), destination);
        await expect(discover(root)).rejects.toThrow("symlink");
      });
    }
  });
});

describe("Preview 待機と安全な失敗理由", () => {
  const d = { id: 1, sha: "sha", environment: "Preview", creator: { login: "vercel[bot]" } };
  const s = { state: "success", environment_url: "https://fixture.vercel.app", creator: { login: "vercel[bot]" } };
  it("5xx の後に再取得して同じ SHA の成功を返す", async () => {
    let calls = 0;
    const request = async <T>(path: string): Promise<T> => {
      if (++calls === 1) throw new ApiError(502);
      return (path.includes("statuses") ? [s] : [d]) as T;
    };
    const wait = vi.fn(async () => {});
    expect(await findDeployment("sha", false, request, wait)).toBe(s.environment_url);
    expect(wait).toHaveBeenCalledTimes(1);
  });
  it("権限エラーは再試行しない", async () => {
    const wait = vi.fn(async () => {});
    await expect(findDeployment("sha", false, async () => { throw new ApiError(403); }, wait)).rejects.toThrow("403");
    expect(wait).not.toHaveBeenCalled();
  });
  it("欠落時は有限回で失敗", async () => {
    const wait = vi.fn(async () => {});
    let calls = 0;
    const request = async <T>(): Promise<T> => { calls++; return [] as T; };
    await expect(findDeployment("sha", false, request, wait)).rejects.toThrow("取得できません");
    expect(calls).toBe(60);
    expect(wait).toHaveBeenCalledTimes(59);
  });
  it("固定文だけを詳細表示し、不明な例外の秘密は表示しない", () => {
    expect(runFailureMessage(new RunFailure("bypass secret が未登録です"))).toContain("未登録");
    expect(runFailureMessage(new Error("sensitive-response"))).not.toContain("sensitive-response");
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
