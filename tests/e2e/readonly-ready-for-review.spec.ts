import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function createSubmittedCase(request: APIRequestContext) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Read-only Submitted ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const capabilityId = body.case.capabilities[0].id as string;

  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification: "Read-only test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Read-only test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Read-only test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);
  expect((await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR })).status()).toBe(201);

  const submitted = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "READY_FOR_REVIEW", comment: "Submitted by read-only test." } });
  expect(submitted.status()).toBe(200);
  return caseId;
}

test.describe("Editor view of a case that is ready for review", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("shows every step as read-only and lets the editor move between steps without saving", async ({ page, request }) => {
    caseId = await createSubmittedCase(request);
    const writes: string[] = [];
    page.on("request", (req) => { if (["PUT", "POST"].includes(req.method()) && req.url().includes(`/api/v1/cases/${caseId}`)) writes.push(`${req.method()} ${req.url()}`); });

    await page.goto(`/cases/${caseId}`);
    // Clicking before React has hydrated silently does nothing in the dev server.
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(page.locator(".readonly-note")).toContainText("awaiting review");
    // The editor cannot submit again or approve; only the reviewer decides.
    await expect(page.getByRole("button", { name: /Submit for review/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Approve case/i })).toHaveCount(0);

    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByRole("button", { name: /Calculate sustainable rates/i })).toHaveCount(0);
    for (const field of await page.locator(".wizard-panel input, .wizard-panel textarea, .wizard-panel select").all()) {
      await expect(field).toBeDisabled();
    }

    await page.getByRole("button", { name: /Back/ }).click();
    await expect(page.getByLabel("Maximum realistic capacity")).toBeDisabled();

    // Moving forward must not try to save (the API would answer 409) and must not show an error.
    const forward = page.getByRole("button", { name: /^Continue/ });
    await forward.click();
    await forward.click();
    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(writes).toEqual([]);
  });
});
