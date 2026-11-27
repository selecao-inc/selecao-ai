// 判定と実行の入口。PR の設定を読み込まず、base 側の設定・reporter で対象を限定する。
import { readFile, writeFile, readdir, mkdir, copyFile, lstat } from "node:fs/promises";
import { resolve, relative, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { checkPullRequest, listChangedFiles, scenarioTargets, type GuardInput, type IssueLookup } from "./pr-guard.mts";

export type Issue = Extract<IssueLookup, { ok: true }> & { reason: string | null };
export type Scenario = { issue: number; file: string; engine: "vitest" | "preview" };
export type Group = { issue: number; mode: "pass" | "fail"; source: "base" | "head"; scenarios: Scenario[] };
export type Plan = { sha: string; groups: Group[]; skipped: string[]; exempt: boolean };
export type Report = {
  complete: boolean;
  planned: number;
  error: boolean;
  tests: { id: string; status: "passed" | "assertion" | "error" | "skipped" }[];
};

export function lightOnly(paths: string[]): boolean {
  return paths.length > 0 && paths.every((p) =>
    p.startsWith("content/") || (p.startsWith("docs/") && !p.startsWith("docs/factory/")));
}

export async function selectScenarios(
  sha: string, scenarios: Scenario[], getIssue: (n: number) => Promise<Issue>, pr?: GuardInput,
  options: { baseScenarios?: Scenario[]; removedFiles?: string[] } = {},
): Promise<Plan> {
  const plan: Plan = { sha, groups: [], skipped: [], exempt: false };
  const cache = new Map<number, Issue>();
  const lookup = async (n: number) => {
    if (!cache.has(n)) cache.set(n, await getIssue(n));
    const i = cache.get(n)!;
    if (!i.ok || i.isPullRequest || i.number !== n) throw new Error(`Issue #${n} を確認できません`);
    return i;
  };
  let target: number | undefined;
  let mode: Group["mode"] = "pass";
  let cleanup: number | undefined;
  let available = options.baseScenarios ?? scenarios;
  if (pr) {
    const guard = await checkPullRequest(pr, lookup);
    if (guard.status === "fail") throw new Error(guard.errors.join("\n"));
    if (guard.status === "skipped" || guard.kind === "factory") {
      plan.exempt = true;
      plan.skipped.push("factory / Dependabot: 対象外");
      return plan;
    }
    target = guard.kind === "scenario" ? scenarioTargets((await lookup(guard.issue)).body)[0] : guard.issue;
    mode = guard.kind === "scenario" ? "fail" : "pass";
    if (mode === "fail") {
      const targetIssue = await lookup(target!);
      // 完了済みの回帰を head で弱めても、base の成功で承認される経路を作らない。
      if (targetIssue.state === "closed" && targetIssue.reason === "completed") {
        throw new Error(`Issue #${target}: completed のシナリオは変更できません。対象を人が再確認してください`);
      }
      const prefix = `tests/scenarios/issue-${target}/`;
      // not_planned の後片付けだけは「失敗を示す新シナリオ」と異なる。
      // base に存在した対象を全削除し、API の全差分がその削除だけの PR に限定する。
      if (targetIssue.state === "closed" && targetIssue.reason === "not_planned" &&
          available.some((s) => s.issue === target) && !scenarios.some((s) => s.issue === target) &&
          pr.changedFiles.length > 0 && pr.changedFiles.every((p) => p.startsWith(prefix) && options.removedFiles?.includes(p))) {
        cleanup = target;
        plan.skipped.push(`Issue #${target}: not_planned のシナリオ全削除`);
        target = undefined;
      } else {
        available = [...available.filter((s) => s.issue !== target), ...scenarios.filter((s) => s.issue === target)];
      }
    }
    if (target !== undefined && !available.some((s) => s.issue === target)) {
      if (mode === "pass" && lightOnly(pr.changedFiles)) {
        plan.skipped.push(`Issue #${target}: 軽の変更のみ、シナリオ0件の例外`);
        target = undefined;
      } else throw new Error(`Issue #${target}: シナリオ0件`);
    }
  }
  const numbers = [...new Set(available.map((s) => s.issue))].sort((a, b) => a - b);
  for (const n of numbers) {
    if (n === cleanup) continue;
    const i = await lookup(n);
    if (i.state === "closed" && i.reason !== "completed") {
      throw new Error(`Issue #${n}: ${i.reason ?? "不明"} で閉じています。シナリオ PR で削除してください`);
    }
    if (i.state !== "closed" && i.state !== "open") throw new Error(`Issue #${n}: 不明な状態`);
    if (n === target || i.state === "closed") {
      // 既に完了した Issue は、シナリオ PR でも回帰を壊すことを認めない。
      plan.groups.push({ issue: n, mode: i.state === "closed" ? "pass" : mode,
        source: n === target && mode === "fail" && i.state === "open" ? "head" : "base",
        scenarios: available.filter((s) => s.issue === n) });
    } else plan.skipped.push(`Issue #${n}: open、対象外`);
  }
  return plan;
}

export function judgeReports(reports: { report: Report; exit: number | null }[], mode: Group["mode"]): boolean {
  if (!reports.length) return false;
  let assertions = 0;
  for (const { report: r, exit } of reports) {
    if (!r.complete || r.error || r.planned === 0 || r.tests.length !== r.planned) return false;
    if (new Set(r.tests.map((t) => t.id)).size !== r.planned) return false;
    if (r.tests.some((t) => !["passed", "assertion"].includes(t.status))) return false;
    const failed = r.tests.filter((t) => t.status === "assertion").length;
    if (exit !== (failed ? 1 : 0)) return false;
    assertions += failed;
  }
  return mode === "fail" ? assertions === reports.reduce((sum, r) => sum + r.report.planned, 0) : assertions === 0;
}

export function deploymentOrigin(url: string): string {
  const u = new URL(url);
  if (u.protocol !== "https:" || u.username || u.password || u.port ||
      !/^[a-z0-9-]+\.vercel\.app$/.test(u.hostname) || u.pathname !== "/" || u.search || u.hash) {
    throw new Error("deployment URL が不正です");
  }
  return u.origin;
}

export async function discover(root: string): Promise<Scenario[]> {
  const results: Scenario[] = [];
  async function walk(dir: string) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = resolve(dir, entry.name);
      if (entry.isSymbolicLink()) throw new Error("シナリオ内の symlink は使えません");
      if (entry.isDirectory()) await walk(path);
      else {
        const file = relative(root, path).replaceAll("\\", "/");
        const match = /^tests\/scenarios\/issue-([1-9]\d*)\/.+\.scenario\.(test|spec)\.ts$/.exec(file);
        if (match) results.push({ issue: Number(match[1]), file, engine: match[2] === "test" ? "vitest" : "preview" });
      }
    }
  }
  const dir = resolve(root, "tests/scenarios");
  try { if ((await lstat(dir)).isSymbolicLink()) throw new Error("シナリオの symlink は使えません"); }
  catch (e) { if ((e as NodeJS.ErrnoException).code === "ENOENT") return []; throw e; }
  await walk(dir);
  return results.sort((a, b) => a.file.localeCompare(b.file));
}

// API の本文・例外に秘密や外部入力が混ざらないよう、失敗は HTTP status と固定文だけを出す。
async function api<T>(path: string): Promise<T> {
  const response = await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}${path}`, {
    headers: { authorization: `Bearer ${process.env.GITHUB_TOKEN}`, accept: "application/vnd.github+json" },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`GitHub API HTTP ${response.status}`);
  return await response.json() as T;
}
type RawIssue = { number: number; state: Issue["state"]; state_reason: string | null; pull_request?: unknown;
  body: string | null; labels: { name: string }[] };
async function getIssue(n: number): Promise<Issue> {
  const i = await api<RawIssue>(`/issues/${n}`);
  return { ok: true, number: i.number, state: i.state, reason: i.state_reason, isPullRequest: !!i.pull_request,
    body: i.body ?? "", labels: i.labels.map((l) => l.name) };
}
type Deployment = { id: number; sha: string; environment: string; creator: { login: string }; };
export type DeploymentStatus = { state: string; environment_url: string; creator: { login: string } };
export function verifiedDeployment(d: Deployment, status: DeploymentStatus, sha: string, production: boolean): string | null {
  if (d.sha !== sha || d.environment.toLowerCase() !== (production ? "production" : "preview") ||
      d.creator.login !== "vercel[bot]" || status.creator.login !== "vercel[bot]" || status.state !== "success") return null;
  return deploymentOrigin(status.environment_url);
}

async function findDeployment(sha: string, production: boolean): Promise<string> {
  // Vercel のビルドを最大10分待つ。ページ送りし、別 SHA や移動する alias を使わない。
  for (let attempt = 0; attempt < 60; attempt++) {
    for (let page = 1; ; page++) {
      const ds = await api<Deployment[]>(`/deployments?sha=${sha}&per_page=100&page=${page}`);
      for (const d of ds) {
        const ss = await api<DeploymentStatus[]>(`/deployments/${d.id}/statuses?per_page=1`);
        if (!ss[0]) continue;
        const origin = verifiedDeployment(d, ss[0], sha, production);
        if (origin) return origin;
      }
      if (ds.length < 100) break;
    }
    await new Promise((r) => setTimeout(r, 10_000));
  }
  throw new Error("同じ SHA の成功した Vercel deployment を取得できません");
}

async function makePlan(subject: string, output: string) {
  const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH!, "utf8"));
  let pr: GuardInput | undefined;
  const removedFiles: string[] = [];
  const sha = process.env.SUBJECT_SHA!;
  if (!/^[a-f0-9]{40}$/.test(sha)) throw new Error("対象 SHA が不正です");
  if (event.pull_request) {
    const p = await api<{ head: { sha: string; ref: string }; body: string | null; user: { login: string }; changed_files: number }>(`/pulls/${event.pull_request.number}`);
    if (p.head.sha !== sha) throw new Error("head が変わりました。新 head で再実行してください");
    const files = await listChangedFiles(async (page) => {
      const entries = await api<{ filename: string; previous_filename?: string; status: string }[]>(`/pulls/${event.pull_request.number}/files?per_page=100&page=${page}`);
      removedFiles.push(...entries.filter((f) => f.status === "removed").map((f) => f.filename));
      return { ok: true, files: entries };
    }, p.changed_files);
    if (!files.ok) throw new Error(files.error);
    pr = { repository: process.env.GITHUB_REPOSITORY!, author: p.user.login, branch: p.head.ref, body: p.body ?? "", changedFiles: files.paths };
  }
  const plan = await selectScenarios(sha, await discover(subject), getIssue, pr,
    { baseScenarios: await discover(process.cwd()), removedFiles });
  await writeFile(output, JSON.stringify(plan));
  console.log(`対象 SHA: ${sha}`);
  for (const reason of plan.skipped) console.log(reason);
  const preview = plan.groups.some((g) => g.scenarios.some((s) => s.engine === "preview"));
  const vitest = plan.groups.some((g) => g.scenarios.some((s) => s.engine === "vitest"));
  let origin = "";
  if (preview) origin = await findDeployment(sha, !pr);
  if (process.env.GITHUB_OUTPUT) {
    await writeFile(process.env.GITHUB_OUTPUT, `preview=${preview}\nvitest=${vitest}\norigin=${origin}\n`, { flag: "a" });
  }
}

async function run(subject: string, planFile: string, engine: Scenario["engine"], output: string) {
  const plan: Plan = JSON.parse(await readFile(planFile, "utf8"));
  const results: { issue: number; report: Report; exit: number | null }[] = [];
  const harness = process.cwd();
  // テストプロセスには GitHub API の token を渡さない。Preview に head の依存・設定を持ち込まない。
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  if (engine === "vitest") delete env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (engine === "preview" && !env.VERCEL_AUTOMATION_BYPASS_SECRET) throw new Error("bypass secret が未登録です");
  if (engine === "preview") {
    const origin = deploymentOrigin(env.PREVIEW_ORIGIN!);
    const response = await fetch(origin, { headers: { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET! },
      redirect: "manual", signal: AbortSignal.timeout(30_000) });
    if (response.status !== 200) throw new Error("Preview の事前アクセス確認に失敗しました");
  }
  for (const group of plan.groups) {
    const scenarios = group.scenarios.filter((s) => s.engine === engine);
    if (!scenarios.length) continue;
    const reportFile = resolve(`.scenario-work/${group.issue}-${engine}.json`);
    await mkdir(dirname(reportFile), { recursive: true });
    let root = subject;
    const sourceRoot = group.source === "head" ? subject : harness;
    const destinationRoot = engine === "preview" ? harness : subject;
    if (engine === "preview") root = harness;
    if (sourceRoot !== destinationRoot) {
      // symlink は discover で拒否。issue 配下の補助ファイルも同じ相対パスでコピーする。
      const dir = `tests/scenarios/issue-${group.issue}`;
      async function copy(path: string) {
        const source = resolve(sourceRoot, path);
        const stat = await lstat(source);
        if (stat.isSymbolicLink()) throw new Error("symlink はコピーできません");
        if (stat.isDirectory()) {
          await mkdir(resolve(destinationRoot, path), { recursive: true });
          for (const name of await readdir(source)) await copy(`${path}/${name}`);
        } else await copyFile(source, resolve(destinationRoot, path));
      }
      await copy(dir);
    }
    const executable = resolve(harness, "node_modules/.bin", engine === "preview" ? "playwright" : "vitest");
    const config = resolve(harness, `tests/scenarios/${engine}.config.mts`);
    const args = engine === "preview" ? ["test", "--config", config, ...scenarios.map((s) => s.file)] :
      ["run", "--root", subject, "--config", config, ...scenarios.map((s) => s.file)];
    console.log(JSON.stringify({ command: executable, args, issue: group.issue, files: scenarios.map((s) => s.file) }));
    const child = spawnSync(executable, args, { cwd: root, env: { ...env, SCENARIO_REPORT: reportFile },
      timeout: 180_000, stdio: "pipe", maxBuffer: 1024 * 1024 });
    // 生ログは保存しない。エラーの expected/actual や HTTP header が秘密を含む可能性がある。
    const report: Report = JSON.parse(await readFile(reportFile, "utf8"));
    console.log(`issue-${group.issue} ${engine}: planned=${report.planned}, executed=${report.tests.length}, exit=${child.status}`);
    for (const t of report.tests) console.log(`ID=${t.id} ${t.status}`);
    results.push({ issue: group.issue, report, exit: child.error ? null : child.status });
  }
  await writeFile(output, JSON.stringify(results));
}

async function main() {
  const [command, subjectArg, planArg, engineArg, output] = process.argv.slice(2);
  const subject = resolve(subjectArg ?? ".");
  if (command === "plan") await makePlan(subject, planArg);
  else if (command === "run") await run(subject, planArg, engineArg as Scenario["engine"], output);
  else if (command === "judge") {
    const plan: Plan = JSON.parse(await readFile(subject, "utf8"));
    const results: { issue: number; report: Report; exit: number | null }[] = [];
    if (plan.groups.length) {
      for (const file of await readdir(planArg)) results.push(...JSON.parse(await readFile(resolve(planArg, file), "utf8")));
    }
    for (const g of plan.groups) {
      const reports = results.filter((r) => r.issue === g.issue);
      const engines = new Set(g.scenarios.map((s) => s.engine)).size;
      if (reports.length !== engines || !judgeReports(reports, g.mode)) throw new Error(`Issue #${g.issue}: 不合格 (${g.mode})`);
      console.log(`Issue #${g.issue}: 合格 (${g.mode})`);
    }
    console.log(`SHA ${plan.sha}: PASS (${plan.groups.length} グループ)`);
  } else throw new Error("plan / run / judge を指定してください");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { await main(); }
  catch (e) {
    // テストプロセスの例外・本文は表示しない。API/判定の固定メッセージのみ使用する。
    console.error(process.argv[2] === "run" ? "シナリオ実行エラー（起動・report・timeout を確認）" : (e as Error).message);
    process.exitCode = 1;
  }
}
