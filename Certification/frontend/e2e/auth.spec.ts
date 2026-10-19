import { expect, test } from "@playwright/test";
import { BACKEND_REASON, CREDENTIALS, DASHBOARD_FOR_ROLE, E2E_ROLE, isBackendAvailable, login } from "./helpers";

/** Authentication flows — only meaningful against a live backend. */
test.describe("auth flows (backend required)", () => {
  test.beforeEach(async () => {
    test.skip(!(await isBackendAvailable()), BACKEND_REASON);
    test.skip(!CREDENTIALS.email || !CREDENTIALS.password, "Set E2E_EMAIL and E2E_PASSWORD to a real account.");
  });

  test("valid credentials land on the role dashboard", async ({ page }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));
  });

  test("invalid credentials show the generic error and never redirect", async ({ page }) => {
    await login(page, CREDENTIALS.email, "definitely-the-wrong-password");
    await expect(page.getByText("The email address or password is incorrect.")).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the session survives a full page refresh", async ({ page }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    await page.reload();
    // Still authenticated: no bounce back to /login.
    await expect(page).not.toHaveURL(/\/login/);
  });

  test("signing out ends the session everywhere", async ({ page }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    // Account dropdown trigger (the last header button; Radix owns its ARIA state).
    await page.locator("header").getByRole("button").last().click();
    await page.getByRole("menuitem", { name: "Sign out" }).click();

    await page.waitForURL(/\/login/);
    // A protected page now bounces again — the session is really gone.
    await page.goto(DASHBOARD_FOR_ROLE[E2E_ROLE]);
    await page.waitForURL(/\/login/);
  });
});