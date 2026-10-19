import { expect, test } from "@playwright/test";
import { BACKEND_REASON, CREDENTIALS, DASHBOARD_FOR_ROLE, E2E_ROLE, isBackendAvailable, login } from "./helpers";

/**
 * Role-based navigation, unauthorized access, multi-agency switching,
 * session expiry and keyboard navigation — all require a live backend.
 */
test.describe("role-based navigation (backend required)", () => {
  test.beforeEach(async () => {
    test.skip(!(await isBackendAvailable()), BACKEND_REASON);
    test.skip(!CREDENTIALS.email || !CREDENTIALS.password, "Set E2E_EMAIL and E2E_PASSWORD to a real account.");
  });

  test("the shell shows only the signed-in role's portal navigation", async ({ page }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    // The portal navigation is duplicated for mobile; assert against the primary one.
    const portalNav = page.locator('nav[aria-label$="navigation"]').first();
    await expect(portalNav).toBeVisible();

    if (E2E_ROLE === "learner") {
      // Learners must never see platform administration links.
      await expect(portalNav.getByRole("link", { name: "Agencies" })).toHaveCount(0);
      await expect(portalNav.getByRole("link", { name: "My learning" })).toHaveCount(1);
    }
    if (E2E_ROLE === "agency_admin") {
      await expect(portalNav.getByRole("link", { name: "Members" })).toHaveCount(1);
      await expect(portalNav.getByRole("link", { name: "Audit & operations" })).toHaveCount(0);
    }
    if (E2E_ROLE === "super_admin" || E2E_ROLE === "training_manager") {
      await expect(portalNav.getByRole("link", { name: "Agencies" })).toHaveCount(1);
    }
  });

  test("direct access to a foreign portal is refused (access-denied, not a leak)", async ({ page }) => {
    // super_admin is intentionally allowed in every portal; training_manager
    // is platform-only (agency portal refuses it), the rest face /platform.
    test.skip(E2E_ROLE === "super_admin", "super_admin has access to all portals by design.");
    const foreignPortal = E2E_ROLE === "training_manager" ? "/agency" : "/platform";

    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    await page.goto(foreignPortal);
    await expect(page).toHaveURL(/\/access-denied/);
    // The foreign portal's content (and its navigation) must not be rendered.
    await expect(page.getByRole("heading", { name: "Access denied" })).toBeVisible();
  });

  test("a lost session sends the user back to sign-in (session expiry)", async ({ page, context }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    await context.clearCookies(); // simulate the HttpOnly session cookie expiring
    await page.reload();

    await expect(page).toHaveURL(/\/(login|session-expired)/);
    await expect(page.getByRole("heading", { name: /sign in|session expired/i })).toBeVisible();
  });

  test("authenticated keyboard navigation: skip link jumps focus to main content", async ({ page }) => {
    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main-content")).toBeFocused();
  });

  test("multi-agency users can switch the active agency", async ({ page }) => {
    test.skip(
      process.env.E2E_MULTI_AGENCY !== "true",
      "Set E2E_MULTI_AGENCY=true with an account that belongs to at least two agencies."
    );

    await login(page);
    await page.waitForURL(new RegExp(`${DASHBOARD_FOR_ROLE[E2E_ROLE]}(?:$|/)`));

    const selector = page.getByRole("button", { name: /Active agency: .*Change agency/ });
    await expect(selector).toBeVisible();

    const firstAgency = (await selector.innerText()).trim();
    await selector.click();

    const options = page.getByRole("menuitemcheckbox");
    await expect(options).toHaveCount(2); // membership in two agencies
    await options.nth(1).click();

    await expect(selector).not.toHaveText(firstAgency);
    // Choice persists for the tab (survives reload).
    await page.reload();
    await expect(selector).not.toHaveText(firstAgency);
  });
});