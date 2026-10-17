import { defineConfig, devices } from "@playwright/test";
import { BASE_URL } from "./e2e/helpers";

/**
 * E2E suite — documented to run against a LIVE backend.
 *
 * There is no backend on this machine (see docs/INTEGRATION_BLOCKERS.md), so:
 *  - `e2e/smoke.spec.ts` runs everywhere (public UI, guards, keyboard basics —
 *    it only exercises frontend behaviour that works with /api answering 404).
 *  - Every other spec self-skips unless a backend answers on BASE_URL
 *    (BACKEND_PROXY=true + BACKEND_ORIGIN, or E2E_BASE_URL pointed at a
 *    deployment) and credentials are supplied via E2E_EMAIL / E2E_PASSWORD.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure"
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000
  }
});