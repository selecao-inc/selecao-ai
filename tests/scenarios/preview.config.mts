import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";

export default defineConfig({
  testDir: fileURLToPath(new URL("./", import.meta.url)),
  testMatch: /issue-\d+\/.*\.scenario\.spec\.ts$/,
  reporter: [[fileURLToPath(new URL("./preview-reporter.mts", import.meta.url))]],
  timeout: 30_000,
  globalTimeout: 150_000,
  retries: 0,
  workers: 1,
  quiet: true,
  forbidOnly: true,
  use: { baseURL: process.env.PREVIEW_ORIGIN, serviceWorkers: "block", trace: "off", screenshot: "off", video: "off" },
});
