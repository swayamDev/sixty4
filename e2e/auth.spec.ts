// e2e/auth.spec.ts
//
// The one critical flow that needs a real signed-in user: start a game and
// make a move. Requires a real Clerk instance and a Clerk test user, so it's
// skipped entirely unless E2E_CLERK_USER_EMAIL/E2E_CLERK_USER_PASSWORD (and
// the usual NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY/CLERK_SECRET_KEY) are set --
// see TESTING.md. Not run as part of this change; written against the UI
// contract the source comments in ai-setup.tsx and game-action-bar.tsx pin
// (persona buttons named "Play {name}", board squares as data-square="e2",
// the 2D/3D toggle labelled by the mode you'd switch *to*), but unverified
// end-to-end since this sandbox can't download a Playwright browser.
import { clerk, clerkSetup } from "@clerk/testing/playwright";
import { expect, test } from "@playwright/test";

const EMAIL = process.env.E2E_CLERK_USER_EMAIL;
const PASSWORD = process.env.E2E_CLERK_USER_PASSWORD;

test.describe("authenticated play flow", () => {
  test.skip(!EMAIL || !PASSWORD, "requires E2E_CLERK_USER_EMAIL/PASSWORD, see TESTING.md");

  test.beforeAll(async () => {
    await clerkSetup();
  });

  test("sign in, start an AI game, and make the opening move", async ({ page }) => {
    await page.goto("/sign-in");
    await clerk.signIn({
      page,
      signInParams: { strategy: "password", identifier: EMAIL!, password: PASSWORD! },
    });

    await page.goto("/play");
    await expect(page.getByRole("group", { name: "Opponent" })).toBeVisible();

    // Whichever persona is pre-selected; default difficulty isn't pinned here,
    // just that starting a game is possible.
    await page.getByRole("button", { name: /^Play /, exact: false }).first().click();
    await page.waitForURL(/\/game\/[^/]+$/, { timeout: 15_000 });

    // Board defaults to 3D; switch to 2D so moves can target data-square cells
    // instead of WebGL canvas pixels. If already 2D (e.g. no WebGL2 in this
    // browser), the "2D" button won't exist and this is a no-op.
    const switchTo2d = page.getByRole("button", { name: "2D" });
    if (await switchTo2d.isVisible().catch(() => false)) {
      await switchTo2d.click();
    }

    // Play white's opening move if we were seated white; if seated black,
    // just confirm the board rendered and the AI is to move first.
    const e2 = page.locator('[data-square="e2"]');
    const e4 = page.locator('[data-square="e4"]');
    await expect(e2.or(page.getByText(/thinking|Pip|Marco|Ada|Viktor|Kasparova/i).first())).toBeVisible({
      timeout: 15_000,
    });
    if (await e2.isVisible().catch(() => false)) {
      await e2.click();
      await e4.click();
      await expect(page.getByText(/^1\./)).toBeVisible({ timeout: 10_000 });
    }
  });
});
