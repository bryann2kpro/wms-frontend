import { defineConfig, devices } from "@playwright/test";

/**
 * E2E test configuration for SME-Edaran WMS frontend.
 *
 * Prerequisites before running:
 *   1. Backend running on http://localhost:7777
 *   2. Frontend dev server running on http://localhost:3000
 *   3. .env.e2e file with E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD, E2E_API_KEY
 *
 * Run:
 *   pnpm exec playwright test
 *   pnpm exec playwright test --ui       (interactive)
 *   pnpm exec playwright test --headed   (show browser)
 */

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    /**
     * Setup project: logs in once and saves auth state to a file.
     * All other tests depend on this so they start already authenticated.
     */
    {
      name: "setup",
      testMatch: /e2e\/setup\/auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
  ],
});
