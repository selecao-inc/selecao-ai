import { writeFileSync } from "node:fs";
import type { Reporter, FullConfig, FullResult, Suite, TestCase, TestResult, TestStep } from "@playwright/test/reporter";
import type { Report } from "../../.github/scripts/scenario-runner.mts";

export default class ScenarioReporter implements Reporter {
  report: Report = { complete: false, planned: 0, error: false, tests: [] };
  assertions = new Map<string, Set<string>>();
  onBegin(_config: FullConfig, suite: Suite) { this.report.planned = suite.allTests().length; }
  onError() { this.report.error = true; }
  onStepEnd(test: TestCase, _result: TestResult, step: TestStep) {
    if (step.category === "expect" && step.error?.message) {
      const messages = this.assertions.get(test.id) ?? new Set<string>();
      messages.add(step.error.message);
      this.assertions.set(test.id, messages);
    }
  }
  onTestEnd(test: TestCase, result: TestResult) {
    const assertion = result.errors.length > 0 && result.errors.every((e) =>
      e.message && this.assertions.get(test.id)?.has(e.message));
    this.report.tests.push({ id: test.id, status: result.status === "passed" ? "passed" :
      result.status === "failed" && assertion ? "assertion" : result.status === "skipped" ? "skipped" : "error" });
  }
  onEnd(result: FullResult) {
    this.report.complete = result.status === "passed" || result.status === "failed";
    writeFileSync(process.env.SCENARIO_REPORT!, JSON.stringify(this.report));
  }
}
