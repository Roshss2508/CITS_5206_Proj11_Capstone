import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };
const REVIEWER = { "x-demo-role": "REVIEWER" };

interface CaseInputs {
  capabilityId: string;
  costAmount: string;
  costJustification: string;
}

async function saveInputs(request: APIRequestContext, caseId: string, inputs: CaseInputs) {
  const { capabilityId } = inputs;
  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: inputs.costAmount, justification: inputs.costJustification }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Stale snapshot test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Stale snapshot test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);
}

async function getCase(request: APIRequestContext, caseId: string) {
  const response = await request.get(`/api/v1/cases/${caseId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).case;
}

async function createCalculatedCase(request: APIRequestContext) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Stale Snapshot ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const inputs: CaseInputs = { capabilityId: body.case.capabilities[0].id, costAmount: "10000", costJustification: "Original evidence." };
  await saveInputs(request, caseId, inputs);
  const calculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
  expect(calculated.status()).toBe(201);
  return { caseId, inputs };
}

function submit(request: APIRequestContext, caseId: string) {
  return request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "READY_FOR_REVIEW", comment: "Submitted by stale snapshot test." } });
}

test.describe("Issue #30 – stale snapshots block submission", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    // Cases cannot be deleted through the API, so archive the test case to keep the dashboard tidy.
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("a freshly calculated case has a current snapshot and can be submitted", async ({ request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;

    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");
    expect((await submit(request, caseId)).status()).toBe(200);
  });

  test("changing an input blocks submission until the case is recalculated", async ({ request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    const original = await getCase(request, caseId);
    const originalSnapshot = original.snapshots[0];

    await saveInputs(request, caseId, { ...created.inputs, costAmount: "25000" });
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("STALE");

    const blocked = await submit(request, caseId);
    expect(blocked.status()).toBe(409);
    expect(await blocked.text()).toMatch(/recalculate/i);
    expect((await getCase(request, caseId)).costingCase.status).toBe("DRAFT");

    const recalculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const afterRecalculation = await getCase(request, caseId);
    expect(afterRecalculation.snapshotFreshness).toBe("CURRENT");

    // The earlier snapshot is preserved byte for byte; recalculation only appends a new one.
    expect(afterRecalculation.snapshots).toHaveLength(2);
    const preserved = afterRecalculation.snapshots.find((snapshot: { id: string }) => snapshot.id === originalSnapshot.id);
    expect(preserved).toEqual(originalSnapshot);
    expect(afterRecalculation.snapshots[0].id).not.toBe(originalSnapshot.id);

    expect((await submit(request, caseId)).status()).toBe(200);
  });

  test("saving the same inputs again or rewording evidence keeps the snapshot current", async ({ request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;

    await saveInputs(request, caseId, created.inputs);
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");

    await saveInputs(request, caseId, { ...created.inputs, costJustification: "Reworded evidence for the same annual cost." });
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");
    expect((await submit(request, caseId)).status()).toBe(200);
  });

  test("submission is still refused for a case that has never been calculated", async ({ request }) => {
    const created = await request.post("/api/v1/cases", { headers: EDITOR, data: { platformName: `QA No Snapshot ${Date.now()}`, pricingPeriod: "2027-2029" } });
    caseId = (await created.json()).case.costingCase.id as string;

    expect((await getCase(request, caseId)).snapshotFreshness).toBe("NONE");
    const response = await submit(request, caseId);
    expect(response.status()).toBe(409);
    expect(await response.text()).toMatch(/Create a calculation snapshot/i);
  });

  test("Issue #39 – a restored case must be recalculated after an input change before it can be submitted", async ({ request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    const before = await getCase(request, caseId);
    const originalSnapshot = before.snapshots[0];

    const archived = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived for restore test." } });
    expect(archived.status()).toBe(200);
    const restored = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "DRAFT", comment: "Restored for stale snapshot test." } });
    expect(restored.status()).toBe(200);

    const afterRestore = await getCase(request, caseId);
    expect(afterRestore.costingCase.status).toBe("DRAFT");
    expect(afterRestore.snapshotFreshness).toBe("CURRENT");
    expect(afterRestore.snapshots).toEqual(before.snapshots);

    await saveInputs(request, caseId, { ...created.inputs, costAmount: "31000" });
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("STALE");

    const blocked = await submit(request, caseId);
    expect(blocked.status()).toBe(409);
    expect(await blocked.text()).toMatch(/recalculate/i);
    expect((await getCase(request, caseId)).costingCase.status).toBe("DRAFT");

    const recalculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const newSnapshotId = (await recalculated.json()).snapshot.id as string;
    expect(newSnapshotId).not.toBe(originalSnapshot.id);

    const afterRecalculation = await getCase(request, caseId);
    expect(afterRecalculation.snapshotFreshness).toBe("CURRENT");
    expect(afterRecalculation.snapshots).toHaveLength(before.snapshots.length + 1);
    expect(afterRecalculation.snapshots.map((snapshot: { id: string }) => snapshot.id)).toEqual(
      expect.arrayContaining([originalSnapshot.id, newSnapshotId]),
    );

    const submitted = await submit(request, caseId);
    expect(submitted.status()).toBe(200);
    expect((await getCase(request, caseId)).costingCase.status).toBe("READY_FOR_REVIEW");
  });

  test("returning a submitted case to draft and editing it makes the old snapshot stale", async ({ request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    expect((await submit(request, caseId)).status()).toBe(200);

    const returned = await request.post(`/api/v1/cases/${caseId}/status`, { headers: REVIEWER, data: { status: "DRAFT", comment: "Changes required." } });
    expect(returned.status()).toBe(200);
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");

    await saveInputs(request, caseId, { ...created.inputs, costAmount: "12345" });
    expect((await submit(request, caseId)).status()).toBe(409);
  });
});

async function openCase(page: Page, caseId: string) {
  await page.goto(`/cases/${caseId}`);
  // Clicking before React has hydrated silently does nothing in the dev server.
  await page.waitForLoadState("networkidle");
}

test.describe("Issue #30 – recalculation prompts in the wizard", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("Step 5 asks for a recalculation and blocks Submit until the case is recalculated", async ({ page, request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    const submitButton = page.getByRole("button", { name: /Submit for review/i });
    const notice = page.locator("#stale-snapshot-notice");

    await openCase(page, caseId);
    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(submitButton).toBeEnabled();
    await expect(notice).toHaveCount(0);

    // Another user or tab changes a calculation input after the calculation was made.
    await saveInputs(request, caseId, { ...created.inputs, costAmount: "25000" });
    await page.reload();
    await page.waitForLoadState("networkidle");

    await expect(notice).toContainText("Recalculation required");
    await expect(page.getByRole("heading", { name: "Snapshot out of date" })).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await notice.getByRole("button", { name: /Go to Step 4 to recalculate/i }).click();
    await expect(page.getByRole("heading", { name: /Compare sustainable rates/i })).toBeVisible();
    await expect(page.getByText("These figures are out of date")).toBeVisible();
    await expect(page.getByText("Recalculation required")).toBeVisible();

    await page.getByRole("button", { name: /Recalculate & save new snapshot/i }).click();
    await expect(page.getByText("These figures are out of date")).toHaveCount(0);
    await expect(page.getByText("Recalculation required")).toHaveCount(0);

    await page.getByRole("button", { name: /Save & continue/i }).click();
    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(notice).toHaveCount(0);
    await expect(submitButton).toBeEnabled();

    await submitButton.click();
    await expect(page.locator(".wizard-status-row .pill")).toHaveText(/ready for review/i);
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("editing a rate in Step 4 flags the results as out of date, but rewording a justification does not", async ({ page, request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    const outOfDate = page.getByText("These figures are out of date");
    const saveState = page.locator(".save-state");
    const savedProposedRates = () => page.waitForResponse((response) => response.url().includes(`/api/v1/cases/${caseId}/proposed-rates`) && response.request().method() === "PUT");

    await openCase(page, caseId);
    await page.getByRole("button", { name: /Back/i }).click();
    await expect(page.getByRole("heading", { name: /Compare sustainable rates/i })).toBeVisible();
    await expect(outOfDate).toHaveCount(0);

    // Evidence text is not a calculation input, so autosaving it must leave the snapshot current.
    let saved = savedProposedRates();
    await page.getByLabel("Pricing justification").first().fill("Reworded justification for the same scenario.");
    expect((await saved).status()).toBe(200);
    await expect(saveState).toContainText("All changes saved");
    await expect(outOfDate).toHaveCount(0);
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");

    // A proposed rate is a calculation input: the autosave must surface the warning without a reload.
    saved = savedProposedRates();
    await page.getByLabel("Proposed rate").first().fill("150");
    expect((await saved).status()).toBe(200);
    await expect(outOfDate).toBeVisible();
    await expect(page.getByText("Recalculation required")).toBeVisible();
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("STALE");

    await page.getByRole("button", { name: /Recalculate & save new snapshot/i }).click();
    await expect(outOfDate).toHaveCount(0);
    expect((await getCase(request, caseId)).snapshotFreshness).toBe("CURRENT");
  });

  test("a restored case whose inputs did not change can be submitted without recalculating", async ({ page, request }) => {
    const created = await createCalculatedCase(request);
    caseId = created.caseId;
    for (const status of ["ARCHIVED", "DRAFT"]) {
      const response = await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status, comment: "Restore round trip." } });
      expect(response.status()).toBe(200);
    }

    await openCase(page, caseId);
    await expect(page.getByRole("heading", { name: /Review the evidence package/i })).toBeVisible();
    await expect(page.locator("#stale-snapshot-notice")).toHaveCount(0);
    await page.getByRole("button", { name: /Submit for review/i }).click();
    await expect(page.locator(".wizard-status-row .pill")).toHaveText(/ready for review/i);
  });
});
