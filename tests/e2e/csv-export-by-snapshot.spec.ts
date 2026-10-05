import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function createCalculatedCase(request: APIRequestContext, justification: string) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA CSV Snapshot ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const capabilityId = body.case.capabilities[0].id as string;

  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "CSV export test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "CSV export test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);

  const calculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
  expect(calculated.status()).toBe(201);
  const snapshotId = (await calculated.json()).snapshot.id as string;
  return { caseId, capabilityId, snapshotId };
}

test.describe("Issue #41 follow-up – CSV export honours ?snapshot= and exposes snapshot metadata", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("a historical snapshot's CSV keeps its own rate figures after recalculation", async ({ request }) => {
    const created = await createCalculatedCase(request, "CSV_SNAPSHOT_ONE");
    caseId = created.caseId;

    const edited = await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: created.capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "50000", justification: "CSV_SNAPSHOT_TWO" }] },
    });
    expect(edited.status()).toBe(200);
    const recalculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const secondSnapshotId = (await recalculated.json()).snapshot.id as string;

    const historicalCsv = await request.get(`/api/v1/cases/${caseId}/export.csv?snapshot=${created.snapshotId}`);
    expect(historicalCsv.status()).toBe(200);
    const historicalRows = (await historicalCsv.text()).trim().split("\r\n");
    const historicalHeaderIndex = historicalRows.findIndex((row) => row.startsWith('"Capability"'));
    const historicalCost = historicalRows[historicalHeaderIndex + 1].split(",")[3];

    const latestCsv = await request.get(`/api/v1/cases/${caseId}/export.csv`);
    const latestRows = (await latestCsv.text()).trim().split("\r\n");
    const latestHeaderIndex = latestRows.findIndex((row) => row.startsWith('"Capability"'));
    const latestCost = latestRows[latestHeaderIndex + 1].split(",")[3];

    expect(historicalCost, "the older snapshot's CSV must not pick up the later recalculation").not.toBe(latestCost);
    expect(secondSnapshotId).not.toBe(created.snapshotId);
  });

  test("exposes the snapshot's creation time, formula version and creator name", async ({ request }) => {
    const created = await createCalculatedCase(request, "CSV_METADATA_MARKER");
    caseId = created.caseId;

    const response = await request.get(`/api/v1/cases/${caseId}/export.csv?snapshot=${created.snapshotId}`);
    expect(response.status()).toBe(200);
    const text = await response.text();

    expect(text).toContain("Formula version");
    expect(text).toContain("RIC_FORMULA_V1");
    expect(text).toContain("Snapshot created");
    expect(text).toContain("Created by");
    expect(text).toContain("Alex Morgan");
  });

  test("returns 404 for a snapshot id that does not belong to the case", async ({ request }) => {
    const created = await createCalculatedCase(request, "CSV_404_MARKER");
    caseId = created.caseId;

    const response = await request.get(`/api/v1/cases/${caseId}/export.csv?snapshot=does-not-exist`);
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("Snapshot not found.");
  });

  test("returns 409 when the case has no snapshot yet", async ({ request }) => {
    const draft = await request.post("/api/v1/cases", {
      headers: EDITOR,
      data: { platformName: `QA CSV No Snapshot ${Date.now()}`, pricingPeriod: "2027-2029" },
    });
    expect(draft.status()).toBe(201);
    caseId = (await draft.json()).case.costingCase.id as string;

    const response = await request.get(`/api/v1/cases/${caseId}/export.csv`);
    expect(response.status()).toBe(409);
  });
});
