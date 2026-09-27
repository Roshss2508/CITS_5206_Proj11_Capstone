import { expect, test } from "@playwright/test";

// There is no hard-delete endpoint for costing cases, so archive any case this file
// creates once the test finishes, matching the pattern in business-rules.spec.ts.
let caseIdToArchive: string | null = null;

test.afterEach(async ({ request }) => {
  if (!caseIdToArchive) return;
  await request.post(`/api/v1/cases/${caseIdToArchive}/status`, { data: { status: "ARCHIVED" } });
  caseIdToArchive = null;
});

test("audit history opens from the dashboard and lets the user pick a case", async ({ page, request }) => {
  const platformName = `Audit Nav Test ${Date.now()}`;
  const created = await request.post("/api/v1/cases", {
    headers: { "x-demo-role": "EDITOR" },
    data: { platformName, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  caseIdToArchive = (await created.json()).case.costingCase.id as string;

  await page.goto("/");
  await page.getByRole("link", { name: /Audit history/i }).click();
  await expect(page).toHaveURL(/\/audit$/);
  await expect(page.getByRole("heading", { name: /Audit history is tracked per costing case/i })).toBeVisible();

  const card = page.locator(".case-card").filter({ hasText: platformName });
  await expect(card).toBeVisible();
  await card.getByRole("link", { name: /View audit trail/i }).click();

  await expect(page).toHaveURL(new RegExp(`/cases/${caseIdToArchive}/audit$`));
  await expect(page.getByRole("heading", { name: platformName })).toBeVisible();
  await expect(page.getByText("CASE CREATED")).toBeVisible();
});

test("audit history opens from an open costing case and returns to it", async ({ page }) => {
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: /New costing case/i }).click();
  const platformName = "Audit Nav Open Case Test Platform";
  await page.getByLabel("Platform name").fill(platformName);
  await page.getByRole("button", { name: /Create case/i }).click();
  await expect(page).toHaveURL(/\/cases\/[^/]+$/);
  const caseUrl = page.url();
  caseIdToArchive = new URL(caseUrl).pathname.split("/cases/")[1];

  await page.getByRole("link", { name: /Audit history/i }).click();
  await expect(page).toHaveURL(`${caseUrl}/audit`);
  await expect(page.getByRole("heading", { name: platformName })).toBeVisible();
  await expect(page.getByText("CASE CREATED")).toBeVisible();

  await page.getByRole("link", { name: new RegExp(`Back to ${platformName}`, "i") }).click();
  await expect(page).toHaveURL(caseUrl);
  await expect(page.getByRole("heading", { name: platformName })).toBeVisible();
});
