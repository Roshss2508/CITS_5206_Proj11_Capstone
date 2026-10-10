import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function createSubmittedCase(request: APIRequestContext) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Reviewer Decision ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const capabilityId = body.case.capabilities[0].id as string;

  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification: "Reviewer test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Reviewer test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Reviewer test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);
  expect((await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR })).status()).toBe(201);
  const submitted = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "READY_FOR_REVIEW", comment: "Submitted by reviewer test." } });
  expect(submitted.status()).toBe(200);
  return caseId;
}

test.describe("Reviewer decision on a case that is ready for review", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("only the reviewer can approve, and approval leaves the case read-only", async ({ page, request }) => {
    caseId = await createSubmittedCase(request);

    const byEditor = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "APPROVED", comment: "Editor must not approve." } });
    expect(byEditor.status()).toBe(403);

    await page.addInitScript(() => window.localStorage.setItem("ric-demo-role", "REVIEWER"));
    await page.goto(`/cases/${caseId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Reviewer decision required/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Submit for review/i })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Changes required/i })).toBeVisible();

    await page.getByRole("button", { name: /Approve case/i }).click();
    await expect(page.getByRole("heading", { name: /MVP case approved/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /Approve case/i })).toHaveCount(0);

    const edit = await request.put(`/api/v1/cases/${caseId}/costs`, { headers: EDITOR, data: { costs: [] } });
    expect(edit.status()).toBe(409);
  });

  test("changes required returns the case to the editor as an editable draft", async ({ page, request }) => {
    caseId = await createSubmittedCase(request);

    await page.addInitScript(() => window.localStorage.setItem("ric-demo-role", "REVIEWER"));
    await page.goto(`/cases/${caseId}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Changes required/i }).click();
    await expect(page.getByRole("button", { name: /Changes required/i })).toHaveCount(0);

    const reloaded = await request.get(`/api/v1/cases/${caseId}`, { headers: EDITOR });
    expect((await reloaded.json()).case.costingCase.status).toBe("DRAFT");

    const edit = await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } });
    expect(edit.status()).toBe(200);
  });
});
