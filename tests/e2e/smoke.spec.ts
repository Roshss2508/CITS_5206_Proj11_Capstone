import { expect, test } from "@playwright/test";

test("dashboard exposes the primary costing workflow", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { name: /Transparent pricing/i }),
  ).toBeVisible();

  await expect(
    page.getByText("RIC Formula V1 is active"),
  ).toBeVisible();

  await expect(
    page.getByRole("button", { name: /New costing case/i }),
  ).toBeVisible();
});