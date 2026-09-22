// e2e/public.spec.ts
//
// Covers the pages a signed-out visitor can actually reach. No Clerk/Convex
// credentials required; these run in any environment that can `pnpm dev`.
import { expect, test } from "@playwright/test";

test.describe("landing page", () => {
  test("loads and shows the primary calls to action", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Sixty4/);
    await expect(page.getByRole("link", { name: /pro/i }).first()).toBeVisible();
  });

  test("links to sign-up/sign-in for a signed-out visitor", async ({ page }) => {
    await page.goto("/");
    const authLink = page.getByRole("link", { name: /sign in|sign up|play/i }).first();
    await expect(authLink).toBeVisible();
  });
});

test.describe("pro page", () => {
  test("loads and describes the tutor", async ({ page }) => {
    await page.goto("/pro");
    await expect(page).toHaveTitle("Sixty4 Pro");
    await expect(page.getByText(/tutor/i).first()).toBeVisible();
  });
});

test.describe("leaderboard page", () => {
  test("loads without requiring sign-in", async ({ page }) => {
    const response = await page.goto("/leaderboard");
    expect(response?.ok()).toBe(true);
    await expect(page).toHaveTitle(/Leaderboard/);
  });
});

test.describe("auth entry points", () => {
  test("sign-in page renders Clerk's sign-in form", async ({ page }) => {
    await page.goto("/sign-in");
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 15_000 });
  });

  test("sign-up page renders Clerk's sign-up form", async ({ page }) => {
    await page.goto("/sign-up");
    await expect(page.getByRole("textbox").first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe("protected routes redirect signed-out visitors", () => {
  for (const path of ["/play", "/settings"]) {
    test(`${path} redirects to /sign-in`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/sign-in/);
    });
  }
});

test.describe("SEO routes", () => {
  test("robots.txt disallows the auth-gated and dev paths", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain("Disallow: /play");
    expect(body).toContain("Sitemap:");
  });

  test("sitemap.xml lists the public routes", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.ok()).toBe(true);
    const body = await res.text();
    expect(body).toContain("<loc>");
    expect(body).toContain("/pro</loc>");
  });

  test("the default OG image renders", async ({ request }) => {
    const res = await request.get("/opengraph-image");
    expect(res.ok()).toBe(true);
    expect(res.headers()["content-type"]).toContain("image/png");
  });
});
