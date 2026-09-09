//browser-level validation behavior

import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function seedCase(request: APIRequestContext, platformName: string) {
  const response = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: {
      platformName,
      pricingPeriod: "2027–2029",
    },
  });

  expect(response.status(), "case seeding failed").toBe(201);

  const body = (await response.json()) as {
    case: {
      costingCase: {
        id: string;
      };
    };
  };

  return body.case.costingCase.id;
}

async function gotoStep(
  page: Page,
  stepLabel: RegExp,
  heading: RegExp,
) {
  await page.getByRole("button", { name: stepLabel }).click();

  await expect(
    page.getByRole("heading", { name: heading }),
  ).toBeVisible();
}

test.describe("Issue #6 – validation and empty states", () => {
  let caseId = "";
  let caseName = "";

  test.beforeEach(async ({ page, request }) => {
    caseName =
      `QA Validation Case ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    caseId = await seedCase(request, caseName);

    await page.goto(`/cases/${caseId}`);

    await expect(
      page.getByRole("heading", {
        name: caseName,
        level: 1,
      }),
    ).toBeVisible();
  });

  test.afterEach(async ({ request }) => {
    if (!caseId) return;

    await request.post(`/api/v1/cases/${caseId}/status`, {
      headers: EDITOR,
      data: {
        status: "ARCHIVED",
        comment: "Archived by automated E2E teardown.",
      },
    });

    caseId = "";
  });

  test("Step 3 blocks navigation when utilisation exceeds 100%", async ({ page }) => {
    await gotoStep(
      page,
      /Capacity & utilisation/i,
      /Set realistic capacity and forecast utilisation/i,
    );

    await page
      .getByLabel("Maximum realistic capacity")
      .fill("1000");

    await page
      .getByLabel("Forecast utilisation (%)")
      .fill("150");

    await page
      .getByRole("button", { name: /Save & continue/i })
      .click();

    const alert = page.getByRole("alert");

    await expect(alert).toBeVisible();
    await expect(alert).toContainText(
      "Utilisation cannot exceed 100%",
    );

    // Validation failure must keep the user on Step 3.
    await expect(
      page.getByRole("heading", {
        name: /Set realistic capacity and forecast utilisation/i,
      }),
    ).toBeVisible();
  });

  test("Step 5 shows an empty state before a calculation snapshot exists", async ({ page }) => {
    await gotoStep(
      page,
      /Review & export/i,
      /Review the evidence package/i,
    );

    await expect(
      page.getByText(
        /create a calculation snapshot before review/i,
      ),
    ).toBeVisible();

    await expect(
      page.getByRole("link", { name: /Download PDF/i }),
    ).toHaveCount(0);

    await expect(
      page.getByRole("link", { name: /Export CSV/i }),
    ).toHaveCount(0);
  });
});