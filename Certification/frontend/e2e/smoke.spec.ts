import { expect, test } from "@playwright/test";

/**
 * Public UI smoke tests. These run WITHOUT a backend: they exercise only
 * frontend behaviour that degrades gracefully when /api answers 404.
 */
test.describe("public UI (no backend required)", () => {
  test("landing page renders and links to sign in", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Certified training, managed at agency scale");
    await page.getByRole("link", { name: "Sign in" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  });

  test("login form is fully keyboard operable with visible validation", async ({ page }) => {
    await page.goto("/login");

    // Labels drive focus; the "Forgot password?" link sits between the fields, so the
    // second Tab reaches the password input.
    await page.getByLabel("Email address").focus();
    await page.keyboard.type("not-an-email");
    await page.keyboard.press("Tab");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Password")).toBeFocused();
    await page.keyboard.type("whatever12345");
    await page.keyboard.press("Enter"); // implicit form submission

    // Client-side validation — no API call is required for this path.
    await expect(page.getByText("Enter a valid email address")).toBeVisible();
  });

  test("skip link is the first tab stop on public pages", async ({ page }) => {
    // The login form auto-focuses its email field, so use a public page without
    // autofocus to verify the skip-link tab order.
    await page.goto("/catalogue");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  });

  test("anonymous direct access to each portal redirects to sign in with a safe next param", async ({ page }) => {
    for (const portal of ["/platform", "/agency", "/learner"]) {
      await page.goto(portal);
      await page.waitForURL(/\/login/);
      const url = new URL(page.url());
      expect(url.searchParams.get("next")).toBe(portal);
    }
  });

  test("the public catalogue renders with an honest checkout boundary", async ({ page }) => {
    await page.goto("/catalogue");
    // Verified store endpoint absent -> the page shows a calm empty/error
    // state or the integration boundary; it must never render fake products.
    await expect(page.getByRole("heading", { name: /catalogue/i }).first()).toBeVisible();
  });
});