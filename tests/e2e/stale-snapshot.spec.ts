import { expect, test, type APIRequestContext } from "@playwright/test";

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
