import { describe, expect, it } from "vitest";
import {
  checkPullRequest,
  listChangedFiles,
  type ChangedFileEntry,
  type GuardInput,
  type IssueLookup,
} from "@/.github/scripts/pr-guard.mjs";

const REPO = "selecao-inc/selecao-ai";

function input(over: Partial<GuardInput> = {}): GuardInput {
  return {
    repository: REPO,
    author: "selecao-agents",
    branch: "YusukeOhno16/issue-41-content-loader",
    body: "## 概要\n...\n\nCloses #41",
    changedFiles: ["lib/content.ts"],
    ...over,
  };
}

function issue(over: Partial<Extract<IssueLookup, { ok: true }>> = {}): IssueLookup {
  return { ok: true, number: 41, state: "open", isPullRequest: false, labels: [], body: "", ...over };
}

const found = (i: IssueLookup) => async () => i;

describe("Dependabot", () => {
  it("Dependabot の PR は Closes が無くても対象外として通す", async () => {
    const r = await checkPullRequest(
      input({ author: "dependabot[bot]", body: "Bumps x", branch: "dependabot/npm_and_yarn/x-1.0.0", changedFiles: [".github/workflows/ci.yml"] }),
      found(issue()),
    );
    expect(r.status).toBe("skipped");
  });
});

describe("規則1: Closes がちょうど1つ", () => {
  it("Closes が無いと失敗する", async () => {
    const r = await checkPullRequest(input({ body: "Refs #41" }), found(issue()));
    expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("[規則1]")] });
  });

  it("Closes が複数あると失敗する", async () => {
    const r = await checkPullRequest(input({ body: "Closes #41\nCloses #42" }), found(issue()));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則1\].*2 件/)] });
  });

  it("Fixes など他の閉じるキーワードも数える", async () => {
    const r = await checkPullRequest(input({ body: "Closes #41\nfixes: #42" }), found(issue()));
    expect(r.status).toBe("fail");
  });

  it("別リポの Issue は失敗する", async () => {
    const r = await checkPullRequest(input({ body: "Closes other/repo#41" }), found(issue()));
    expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("別リポジトリ")] });
  });

  it("同じリポの URL 形式は通す", async () => {
    const r = await checkPullRequest(
      input({ body: "Resolves https://github.com/selecao-inc/selecao-ai/issues/41" }),
      found(issue()),
    );
    expect(r).toEqual({ status: "pass", issue: 41, kind: "implementation" });
  });
});

describe("規則2: ブランチ名の番号", () => {
  it("番号が一致しないと失敗する", async () => {
    const r = await checkPullRequest(input({ branch: "YusukeOhno16/issue-42-services" }), found(issue()));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則2\].*一致しません/)] });
  });

  it("issue-<番号>- が無いと失敗する", async () => {
    const r = await checkPullRequest(input({ branch: "feat/content-loader" }), found(issue()));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則2\].*issue-41-/)] });
  });

  it("番号の前方一致では通さない（issue-410- は #41 ではない）", async () => {
    const r = await checkPullRequest(input({ branch: "YusukeOhno16/issue-410-x" }), found(issue()));
    expect(r.status).toBe("fail");
  });
});

describe("規則3: Issue の取得と状態", () => {
  it("API のエラーで取得できないと失敗する", async () => {
    const r = await checkPullRequest(input(), found({ ok: false, error: "HTTP 404" }));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則3\].*HTTP 404/)] });
  });

  it("Issue が閉じていると失敗する", async () => {
    const r = await checkPullRequest(input(), found(issue({ state: "closed" })));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則3\].*閉じています/)] });
  });

  it("番号が PR だと失敗する", async () => {
    const r = await checkPullRequest(input(), found(issue({ isPullRequest: true })));
    expect(r).toEqual({ status: "fail", errors: [expect.stringMatching(/\[規則3\].*PR です/)] });
  });
});

describe("規則4: ラベルと変更範囲", () => {
  const scenarioIssue = issue({ labels: ["scenario"], body: "## 背景\nシナリオ対象: #40\n" });
  const factoryIssue = issue({ labels: ["factory"] });

  it("両方のラベルが付いていると失敗する", async () => {
    const r = await checkPullRequest(input(), found(issue({ labels: ["scenario", "factory"] })));
    expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("両方")] });
  });

  describe("実装 PR（ラベルなし）", () => {
    it("通常のファイルだけなら通す", async () => {
      const r = await checkPullRequest(input({ changedFiles: ["app/page.tsx", "tests/page.test.tsx"] }), found(issue()));
      expect(r).toEqual({ status: "pass", issue: 41, kind: "implementation" });
    });

    it("tests/scenarios/issue-*/ を変えると、Issue の例どおりの理由で失敗する", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["lib/content.ts", "tests/scenarios/issue-41/services.scenario.test.ts"] }),
        found(issue()),
      );
      expect(r).toEqual({
        status: "fail",
        errors: [
          "[規則4] 実装 PR は tests/scenarios/ を変更できません（Issue #41 にラベル scenario・factory がありません）: tests/scenarios/issue-41/services.scenario.test.ts",
        ],
      });
    });

    it("tests/scenarios/ のそのほかを変えると失敗する", async () => {
      const r = await checkPullRequest(input({ changedFiles: ["tests/scenarios/helpers.ts"] }), found(issue()));
      expect(r.status).toBe("fail");
    });

    it.each([".github/workflows/ci.yml", ".github/scripts/pr-guard.mts"])("%s を変えると失敗する", async (path) => {
      const r = await checkPullRequest(input({ changedFiles: [path] }), found(issue()));
      expect(r).toEqual({ status: "fail", errors: [expect.stringContaining(path)] });
    });
  });

  describe("シナリオ PR（scenario）", () => {
    it("シナリオ対象の issue-M/ だけなら通す", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/issue-40/top.scenario.spec.ts"] }),
        found(scenarioIssue),
      );
      expect(r).toEqual({ status: "pass", issue: 41, kind: "scenario" });
    });

    it("ほかの Issue のシナリオを変えると失敗する", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/issue-40/a.spec.ts", "tests/scenarios/issue-42/b.spec.ts"] }),
        found(scenarioIssue),
      );
      expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("tests/scenarios/issue-42/b.spec.ts")] });
    });

    it.each(["tests/scenarios/helpers.ts", ".github/workflows/ci.yml"])("%s を変えると失敗する", async (path) => {
      const r = await checkPullRequest(input({ changedFiles: [path] }), found(scenarioIssue));
      expect(r.status).toBe("fail");
    });

    it("Issue 本文に シナリオ対象 が無いと失敗する", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/issue-40/a.spec.ts"] }),
        found(issue({ labels: ["scenario"], body: "対象なし" })),
      );
      expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("シナリオ対象")] });
    });

    it("全角コロンの シナリオ対象：#M も読む", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/issue-40/a.spec.ts"] }),
        found(issue({ labels: ["scenario"], body: "シナリオ対象：#40" })),
      );
      expect(r.status).toBe("pass");
    });
  });

  describe("工場の仕組みの PR（factory）", () => {
    it("tests/scenarios/ のそのほかと .github/ を変えても通す", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/helpers.ts", ".github/workflows/pr-guard.yml", ".github/scripts/pr-guard.mts"] }),
        found(factoryIssue),
      );
      expect(r).toEqual({ status: "pass", issue: 41, kind: "factory" });
    });

    it("tests/scenarios/issue-*/ を変えると失敗する", async () => {
      const r = await checkPullRequest(
        input({ changedFiles: ["tests/scenarios/issue-40/a.spec.ts"] }),
        found(factoryIssue),
      );
      expect(r).toEqual({ status: "fail", errors: [expect.stringContaining("工場の仕組みの PR は tests/scenarios/")] });
    });
  });
});

it("複数の規則に反したときは、すべての違反を出す", async () => {
  const r = await checkPullRequest(
    input({ branch: "YusukeOhno16/issue-9-x", changedFiles: ["tests/scenarios/issue-41/a.ts"] }),
    found(issue({ state: "closed" })),
  );
  expect(r.status === "fail" && r.errors.map((e) => e.slice(0, 5))).toEqual(["[規則2]", "[規則3]", "[規則4]"]);
});

describe("変更ファイルの取得（API の上限 3,000 件）", () => {
  // files API を模擬する。上限を超えた分は返さず、上限の後は空のページを返す（実際の API と同じ）
  function pages(entries: ChangedFileEntry[], cap = 3000) {
    const visible = entries.slice(0, cap);
    return async (page: number) => ({ ok: true as const, files: visible.slice((page - 1) * 100, page * 100) });
  }
  const many = (n: number, last?: string): ChangedFileEntry[] =>
    Array.from({ length: n }, (_, i) => ({ filename: i === n - 1 && last ? last : `app/f${i}.ts` }));

  it("3,000 件ちょうどなら全件を返す", async () => {
    const r = await listChangedFiles(pages(many(3000)), 3000);
    expect(r.ok && r.paths.length).toBe(3000);
  });

  it("3,001 件で一覧が打ち切られたら失敗する（一覧の外の保護対象を見逃さない）", async () => {
    const r = await listChangedFiles(pages(many(3001, "tests/scenarios/issue-41/a.ts")), 3001);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("3001 件に対し、取得できたのは 3000 件") });
  });

  it("ページの境界（100 件ちょうど）では次のページまで取る", async () => {
    const r = await listChangedFiles(pages(many(100)), 100);
    expect(r.ok && r.paths.length).toBe(100);
  });

  it("リネームは移動元も返すが、件数はファイル単位で照合する", async () => {
    const r = await listChangedFiles(
      pages([{ filename: "tests/x.ts", previous_filename: "tests/scenarios/issue-41/x.ts" }]),
      1,
    );
    expect(r).toEqual({ ok: true, paths: ["tests/x.ts", "tests/scenarios/issue-41/x.ts"] });
  });

  it("API のエラーは失敗にする", async () => {
    const r = await listChangedFiles(async () => ({ ok: false as const, error: "HTTP 502" }), 1);
    expect(r).toEqual({ ok: false, error: expect.stringContaining("HTTP 502") });
  });
});
