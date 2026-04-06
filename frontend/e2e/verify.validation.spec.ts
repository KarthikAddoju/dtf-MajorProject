import { expect, test } from "@playwright/test";

test("blocks non-numeric token ids before issuing a verification request", async ({
  page,
}) => {
  await page.goto("/verify");

  await page.getByRole("textbox").fill("abc-123");
  await page.getByRole("button", { name: "Verify Record" }).click();

  await expect(page.getByText("Token IDs must contain digits only.")).toBeVisible();
  await expect(page).toHaveURL(/\/verify$/);
});
