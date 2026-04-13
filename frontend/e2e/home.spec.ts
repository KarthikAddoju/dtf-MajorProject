import { test, expect } from "@playwright/test";

test("has title and generic content", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/DACS/);
});
