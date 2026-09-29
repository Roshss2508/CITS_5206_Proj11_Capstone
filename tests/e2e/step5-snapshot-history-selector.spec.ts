import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function createCalculatedCase(request: APIRequestContext, amount: string) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Snapshot Browsing ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const capabilityId = body.case.capabilities[0].id as string;

  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount, justification: "Snapshot browsing test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Snapshot browsing test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Snapshot browsing test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);

  const calculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
  expect(calculated.status()).toBe(201);
  const snapshotId = (await calculated.json()).snapshot.id as string;
  return { caseId, capabilityId, snapshotId };
}

test.describe("Issue #41 follow-up – Step 5 snapshot history selector", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("does not show a history list when the case has only one snapshot", async ({ page, request }) => {
    const created = await createCalculatedCase(request, "10000");
    caseId = created.caseId;

    await page.goto(`/cases/${caseId}`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Snapshot history", level: 3 })).toHaveCount(0);
    await expect(page.locator(".snapshot-list")).toHaveCount(0);
  });

  test("lets a reviewer browse an earlier snapshot's figures and export links without affecting the latest one", async ({ page, request }) => {
    const created = await createCalculatedCase(request, "10000");
    caseId = created.caseId;

    const edited = await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: created.capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "40000", justification: "Second snapshot." }] },
    });
    expect(edited.status()).toBe(200);
    const recalculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const latestSnapshotId = (await recalculated.json()).snapshot.id as string;
    expect(latestSnapshotId).not.toBe(created.snapshotId);

    await page.goto(`/cases/${caseId}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();

    const rows = page.locator(".snapshot-list button");
    const pdfLink = page.getByRole("link", { name: /Download PDF/i });
    const csvLink = page.getByRole("link", { name: /Export CSV/i });
    const viewingNotice = page.getByText(/Viewing an earlier snapshot/i);

    await expect(rows).toHaveCount(2);
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first().locator(".pill.green")).toHaveText("Latest");
    await expect(pdfLink).toHaveAttribute("href", new RegExp(`snapshot=${latestSnapshotId}$`));
    await expect(csvLink).toHaveAttribute("href", new RegExp(`snapshot=${latestSnapshotId}$`));
    await expect(viewingNotice).toHaveCount(0);

    await rows.nth(1).click();
    await expect(rows.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first()).toHaveAttribute("aria-pressed", "false");
    await expect(viewingNotice).toBeVisible();
    await expect(pdfLink).toHaveAttribute("href", new RegExp(`snapshot=${created.snapshotId}$`));
    await expect(csvLink).toHaveAttribute("href", new RegExp(`snapshot=${created.snapshotId}$`));

    await rows.first().click();
    await expect(rows.first()).toHaveAttribute("aria-pressed", "true");
    await expect(viewingNotice).toHaveCount(0);
    await expect(pdfLink).toHaveAttribute("href", new RegExp(`snapshot=${latestSnapshotId}$`));
  });
});
