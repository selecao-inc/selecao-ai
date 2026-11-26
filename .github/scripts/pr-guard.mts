// PR と Issue の対応を確かめ、合格シナリオと工場の仕組みの無断変更を止める（Issue #46）。
// 規則と対応表は docs/factory/verification.md の「PR の識別と変更範囲の判定」を正とする。
//
// 実行: node .github/scripts/pr-guard.mts（Node 24 の型除去でそのまま動かす。依存パッケージを持たない）
// ワークフロー（pull_request_target）は main（base）側のこのファイルだけを実行し、PR 側（head）のコードは実行しない。
// そのため、PR でこのファイルやワークフローを書き換えても、その PR の判定は変わらない。
// PR の本文・ブランチ名・変更ファイルは GitHub API から読む（PR のファイルは読み込みも実行もしない）。

import { pathToFileURL } from "node:url";

export type IssueLookup =
  | {
      ok: true;
      number: number;
      state: "open" | "closed";
      isPullRequest: boolean;
      labels: string[];
      body: string;
    }
  | { ok: false; error: string };

export type GuardInput = {
  repository: string; // owner/repo
  author: string;
  branch: string;
  body: string;
  // 変更・追加・削除されたパス。リネームは移動元も含める（シナリオを外へ移す変更を見逃さないため）
  changedFiles: string[];
};

export type PrKind = "scenario" | "factory" | "implementation";

export type GuardResult =
  | { status: "skipped"; reason: string }
  | { status: "pass"; issue: number; kind: PrKind }
  | { status: "fail"; errors: string[] };

const KIND_LABEL: Record<PrKind, string> = {
  scenario: "シナリオ PR",
  factory: "工場の仕組みの PR",
  implementation: "実装 PR",
};

// GitHub が Issue を自動で閉じるキーワードをすべて数える。
// Closes だけを数えると「Closes #1」と「Fixes #2」の併記で2件の Issue を閉じられてしまうため。
const CLOSING_REF =
  /\b(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s+(?:https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/issues\/|([\w.-]+\/[\w.-]+)#|#)(\d+)\b/gi;

export function parseClosingRefs(body: string): { repo: string | null; number: number }[] {
  return [...body.matchAll(CLOSING_REF)].map((m) => ({
    repo: (m[1] ?? m[2] ?? null)?.toLowerCase() ?? null,
    number: Number(m[3]),
  }));
}

export function branchIssueNumbers(branch: string): number[] {
  return [...branch.matchAll(/(?:^|\/)issue-(\d+)-/g)].map((m) => Number(m[1]));
}

export function scenarioTargets(issueBody: string): number[] {
  return [...issueBody.matchAll(/シナリオ対象\s*[:：]\s*#(\d+)/g)].map((m) => Number(m[1]));
}

// 規則4で守るファイルの分類。工場の仕組み（判定とシナリオ実行の定義）を変えられるのは factory の PR だけ
type FileClass =
  | { type: "scenario-issue"; issue: number }
  | { type: "scenario-other" }
  | { type: "factory" }
  | { type: "other" };

export function classify(path: string): FileClass {
  const m = /^tests\/scenarios\/issue-(\d+)\//.exec(path);
  if (m) return { type: "scenario-issue", issue: Number(m[1]) };
  if (path.startsWith("tests/scenarios/")) return { type: "scenario-other" };
  if (path.startsWith(".github/workflows/") || path.startsWith(".github/scripts/")) {
    return { type: "factory" };
  }
  return { type: "other" };
}

export async function checkPullRequest(
  input: GuardInput,
  getIssue: (n: number) => Promise<IssueLookup>,
): Promise<GuardResult> {
  // Dependabot の PR は Issue を持たない（依存更新は Dependabot の PR で行うと AGENTS.md で決めている）
  if (input.author === "dependabot[bot]") {
    return { status: "skipped", reason: "Dependabot の PR は判定の対象外です" };
  }

  // 規則1: 閉じる Issue の指定がちょうど1つ
  const refs = parseClosingRefs(input.body);
  if (refs.length === 0) {
    return {
      status: "fail",
      errors: ["[規則1] PR 本文に `Closes #<Issue番号>` がありません。対応する Issue を1つ指定してください"],
    };
  }
  if (refs.length > 1) {
    const list = refs.map((r) => `${r.repo ?? ""}#${r.number}`).join(", ");
    return {
      status: "fail",
      errors: [`[規則1] PR 本文で閉じる Issue の指定が ${refs.length} 件あります（${list}）。1 PR = 1 Issue なので1つにしてください`],
    };
  }
  const ref = refs[0];
  if (ref.repo !== null && ref.repo !== input.repository.toLowerCase()) {
    return {
      status: "fail",
      errors: [`[規則1] 別リポジトリの Issue（${ref.repo}#${ref.number}）は指定できません。このリポの Issue を指定してください`],
    };
  }
  const n = ref.number;
  const errors: string[] = [];

  // 規則2: ブランチ名の番号と一致
  const branchNumbers = branchIssueNumbers(input.branch);
  if (branchNumbers.length === 0) {
    errors.push(`[規則2] ブランチ名「${input.branch}」に \`issue-${n}-\` が含まれていません`);
  } else if (!branchNumbers.includes(n)) {
    errors.push(
      `[規則2] ブランチ名「${input.branch}」の Issue 番号（${branchNumbers.join(", ")}）が PR 本文の Closes #${n} と一致しません`,
    );
  }

  // 規則3: Issue を取得でき、PR ではなく、開いている
  const issue = await getIssue(n);
  if (!issue.ok) {
    errors.push(`[規則3] Issue #${n} を取得できません（${issue.error}）`);
    return { status: "fail", errors };
  }
  if (issue.isPullRequest) {
    errors.push(`[規則3] #${n} は Issue ではなく PR です`);
    return { status: "fail", errors };
  }
  if (issue.state !== "open") {
    errors.push(`[規則3] Issue #${n} は閉じています。開いている Issue を指定してください`);
  }

  // 規則4: Issue のラベルで PR の種類を決め、変更してよい範囲を判定する
  const hasScenario = issue.labels.includes("scenario");
  const hasFactory = issue.labels.includes("factory");
  if (hasScenario && hasFactory) {
    errors.push(`[規則4] Issue #${n} にラベル scenario と factory の両方が付いています。どちらか1つにしてください`);
    return { status: "fail", errors };
  }
  const kind: PrKind = hasScenario ? "scenario" : hasFactory ? "factory" : "implementation";

  let allowedScenario: number | null = null;
  if (kind === "scenario") {
    const targets = scenarioTargets(issue.body);
    if (targets.length !== 1) {
      errors.push(
        `[規則4] シナリオ PR の Issue #${n} の本文に \`シナリオ対象: #<番号>\` がちょうど1つ必要です（${targets.length} 件）`,
      );
    } else {
      allowedScenario = targets[0];
    }
  }

  const why =
    kind === "implementation"
      ? `Issue #${n} にラベル scenario・factory がありません`
      : `Issue #${n} のラベルは ${kind}`;
  for (const path of [...new Set(input.changedFiles)].sort()) {
    const c = classify(path);
    if (c.type === "scenario-issue") {
      if (kind === "scenario" && c.issue === allowedScenario) continue;
      if (kind === "scenario" && allowedScenario !== null) {
        errors.push(
          `[規則4] シナリオ PR が変更できるのは tests/scenarios/issue-${allowedScenario}/ だけです: ${path}（Issue #${n} のシナリオ対象は #${allowedScenario}）`,
        );
      } else if (kind !== "scenario") {
        errors.push(`[規則4] ${KIND_LABEL[kind]} は tests/scenarios/ を変更できません（${why}）: ${path}`);
      }
    } else if (c.type === "scenario-other" || c.type === "factory") {
      if (kind === "factory") continue;
      const area = c.type === "factory" ? ".github/workflows/・.github/scripts/" : "tests/scenarios/";
      errors.push(`[規則4] ${KIND_LABEL[kind]} は ${area} を変更できません（${why}）: ${path}`);
    }
  }

  if (errors.length > 0) return { status: "fail", errors };
  return { status: "pass", issue: n, kind };
}

export type ChangedFileEntry = { filename: string; previous_filename?: string };

export const FILES_PER_PAGE = 100;

// PR の変更ファイルをページ送りで集める。
// List pull requests files は最大 3,000 件で打ち切られ、それ以上はエラーにならず空のページが返る。
// 一覧の外に保護対象があっても合格にしないよう、PR 情報の changed_files と取得した現在パスの件数を照合する。
// （リネーム元を足した配列の長さとは比べない。changed_files はファイル単位で数えるため）
export async function listChangedFiles(
  getPage: (page: number) => Promise<{ ok: true; files: ChangedFileEntry[] } | { ok: false; error: string }>,
  expectedCount: number,
): Promise<{ ok: true; paths: string[] } | { ok: false; error: string }> {
  const paths: string[] = [];
  let current = 0;
  for (let page = 1; ; page++) {
    const res = await getPage(page);
    if (!res.ok) return { ok: false, error: `の変更ファイルを取得できません（${res.error}）` };
    for (const f of res.files) {
      current++;
      paths.push(f.filename);
      if (f.previous_filename) paths.push(f.previous_filename);
    }
    if (res.files.length < FILES_PER_PAGE) break;
  }
  if (current !== expectedCount) {
    return {
      ok: false,
      error: `の変更ファイルを全件取得できません（PR の変更ファイル ${expectedCount} 件に対し、取得できたのは ${current} 件）。未検査のファイルが残るため判定できません。PR を分割してください`,
    };
  }
  return { ok: true, paths };
}

// ---- 以下は GitHub Actions から実行するときだけ使う ----

async function api(path: string, token: string): Promise<Response> {
  return fetch(`https://api.github.com${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
    },
  });
}

async function main(): Promise<void> {
  console.log("TEST ONLY: always succeeds; never merge");
}

await main();
