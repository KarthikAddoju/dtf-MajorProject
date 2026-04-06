import { expect, test } from "@playwright/test";

test("restores an authenticated upload session without crashing", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("dacs.auth.token", "test-auth-token");
  });

  await page.route("http://localhost:4000/api/auth/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        user: {
          address: "0x1111111111111111111111111111111111111111",
          role: "student",
        },
      }),
    });
  });

  await page.route("http://localhost:4000/api/institutes", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        institutes: [
          {
            id: "507f1f77bcf86cd799439011",
            name: "Anna University",
            shortCode: "ANNAU",
            slug: "anna-university",
            isActive: true,
            verifierCount: 1,
            verifierAddresses: ["0x2222222222222222222222222222222222222222"],
          },
        ],
      }),
    });
  });

  await page.route("http://localhost:4000/api/submissions/me", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        submissions: [],
      }),
    });
  });

  await page.goto("/upload");

  await expect(
    page.getByRole("heading", { name: /submit a new academic credential/i })
  ).toBeVisible();
  await expect(page.getByText("Signed session", { exact: true })).toBeVisible();
  await expect(page.getByText("Something went wrong")).toHaveCount(0);
});
