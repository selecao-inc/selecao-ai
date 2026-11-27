import { writeFileSync } from "node:fs";
import type { Reporter, TestModule } from "vitest/node";
import type { Report } from "../../.github/scripts/scenario-runner.mts";

// 外部入力・テスト名・expected/actual を含まない、件数と ID だけの report を残す。
export default class ScenarioReporter implements Reporter {
  onTestRunEnd(modules: readonly TestModule[], errors: readonly unknown[], reason: string) {
    const report: Report = { complete: reason === "passed" || reason === "failed", planned: 0, error: errors.length > 0, tests: [] };
    for (const testModule of modules) {
      if (testModule.errors().length) report.error = true;
      for (const test of testModule.children.allTests()) {
        report.planned++;
        const r = test.result();
        const assertion = r.errors?.length && r.errors.every((e) => e.name === "AssertionError");
        report.tests.push({ id: test.id, status: r.state === "passed" ? "passed" :
          r.state === "failed" ? assertion ? "assertion" : "error" : "skipped" });
      }
    }
    writeFileSync(process.env.SCENARIO_REPORT!, JSON.stringify(report));
  }
}
