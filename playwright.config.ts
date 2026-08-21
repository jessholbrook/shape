import { defineConfig } from "@playwright/test";

/**
 * Smoke tests only — every public route renders without erroring.
 *
 * Deliberately not a UI-behaviour suite: the playgrounds all need a model to
 * do anything, and asserting on generated text would be flaky by construction.
 * This checks the thing `next build` cannot, which is that the pages actually
 * run.
 */
export default defineConfig({
  testDir: "./tests/smoke",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: process.env.SMOKE_BASE_URL ?? "http://127.0.0.1:3100",
    trace: "on-first-retry",
  },
  // Against a deployed URL, skip the local server entirely.
  //
  // Port 3100 rather than Next's 3000 on purpose: a dev server left running on
  // 3000 would otherwise be reused, and its HMR socket fails every route test
  // for reasons that have nothing to do with the build under test.
  webServer: process.env.SMOKE_BASE_URL
    ? undefined
    : {
        command: "npm run build && npx next start -p 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: false,
        timeout: 180_000,
      },
});
