import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // head の別バージョンや偽の vitest をテストから import させない。
    alias: [{ find: /^vitest$/, replacement: fileURLToPath(import.meta.resolve("vitest")) }],
  },
  test: {
    environment: "node",
    include: ["tests/scenarios/issue-*/*.scenario.test.ts", "tests/scenarios/issue-*/**/*.scenario.test.ts"],
    reporters: [fileURLToPath(new URL("./vitest-reporter.mts", import.meta.url))],
    testTimeout: 15_000,
    hookTimeout: 15_000,
    retry: 0,
    allowOnly: false,
    silent: true,
    disableConsoleIntercept: false,
  },
});
