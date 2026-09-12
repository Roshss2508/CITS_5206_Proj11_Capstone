import { expect, test } from "@playwright/test";

test("business rules opens from the dashboard and returns to it", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: /Business rules/i }).click();
  await expect(page).toHaveURL(/\/business-rules$/);
  await expect(page.getByRole("heading", { name: "RIC Formula V1 business rules" })).toBeVisible();
  await expect(page.getByText("CAPACITY-001")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Awaiting client confirmation/i })).toBeVisible();

  await page.getByRole("link", { name: /Back to costing cases/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: /Transparent pricing/i })).toBeVisible();
});

test("business rules opens from an open costing case and returns to that case", async ({ page }) => {
  await page.goto("/");
  // Wait for hydration to finish before the first interaction: in dev mode the unbundled
  // module graph can still be settling after the "load" event fires, so an immediate click
  // can land before React has attached its handlers.
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /New costing case/i }).click();
  await page.getByLabel("Platform name").fill("Business Rules Nav Test Platform");
  await page.getByRole("button", { name: /Create case/i }).click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  const caseUrl = page.url();

  await page.getByRole("link", { name: /Business rules/i }).click();
  await expect(page).toHaveURL(/\/business-rules\?from=%2Fcases%2F/);
  await expect(page.getByRole("heading", { name: "RIC Formula V1 business rules" })).toBeVisible();

  await page.getByRole("link", { name: /Back to costing case/i }).click();
  await expect(page).toHaveURL(caseUrl);
  await expect(page.getByRole("heading", { name: "Business Rules Nav Test Platform" })).toBeVisible();
});
