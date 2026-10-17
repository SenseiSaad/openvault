import { request, type Page } from "@playwright/test";

/** Mirrors the baseURL used by playwright.config.ts. */
export const BASE_URL = process.env.E2E_BASE_URL ?? `http://127.0.0.1:${process.env.E2E_PORT ?? "3000"}`;

export const BACKEND_REASON =
  "Requires a live backend. Start one via BACKEND_PROXY=true BACKEND_ORIGIN=<url> npm run dev, " +
  "or set E2E_BASE_URL to a deployment. See docs/INTEGRATION_BLOCKERS.md.";

export const CREDENTIALS = {
  email: process.env.E2E_EMAIL ?? "",
  password: process.env.E2E_PASSWORD ?? ""
};

/** Role under test — used to assert the post-login dashboard redirect. */
export const E2E_ROLE = process.env.E2E_ROLE ?? "learner";

export const DASHBOARD_FOR_ROLE: Record<string, string> = {
  super_admin: "/platform",
  training_manager: "/platform",
  agency_admin: "/agency",
  learner: "/learner"
};

let backendPromise: Promise<boolean> | null = null;

/**
 * A real backend answers GET /api/auth/csrf with 200. The Next.js dev server
 * without a proxied backend answers unknown /api routes with 404, which is how
 * we distinguish "no backend" from "backend present".
 */
export function isBackendAvailable(): Promise<boolean> {
  backendPromise ??= (async () => {
    try {
      const ctx = await request.newContext({ baseURL: BASE_URL, timeout: 5_000 });
      try {
        const response = await ctx.get("/api/auth/csrf");
        return response.status() === 200;
      } finally {
        await ctx.dispose();
      }
    } catch {
      return false;
    }
  })();
  return backendPromise;
}

/** Logs in through the real UI (backend required). */
export async function login(page: Page, email = CREDENTIALS.email, password = CREDENTIALS.password): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
}