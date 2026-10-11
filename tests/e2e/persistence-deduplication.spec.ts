import { expect, test, type APIRequestContext } from "@playwright/test";
import type { CostingCaseAggregate } from "../../src/modules/types";

const EDITOR = { "x-demo-role": "EDITOR" };
const REVIEWER = { "x-demo-role": "REVIEWER" };

async function readCase(request: APIRequestContext, caseId: string): Promise<CostingCaseAggregate> {
  const response = await request.get(`/api/v1/cases/${caseId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).case;
}

test.describe("Issue #44 backend duplicate-save protection", () => {
  let caseId: string;
  let capabilityId: string;
  const costs = (count = 1) => Array.from({ length: count }, (_, index) => ({
    id: `${caseId}-cost-${index}`, capabilityId, category: "STAFFING", scope: "CAPABILITY",
    label: `Synthetic cost ${index}`, amount: "100.00", justification: "Synthetic cost evidence.",
  }));
  const income = (count = 1) => Array.from({ length: count }, (_, index) => ({
    id: `${caseId}-income-${index}`, sourceName: `Synthetic support ${index}`, sourceType: "UWA_SUPPORT",
    amount: "20.00", justification: "Synthetic support evidence.",
  }));
  const capacity = () => [{
    id: `${caseId}-capacity`, capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "100",
    historicYear1: null, historicYear2: null, historicYear3: null, justification: "Synthetic utilisation evidence.",
  }];
  const proposedRates = () => [{
    id: `${caseId}-rate`, capabilityId, uwaRate: null, apfrRate: null, commercialRate: null,
    uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Synthetic pricing evidence.",
  }];
  const put = async (request: APIRequestContext, suffix: string, data: unknown) => {
    const response = await request.put(`/api/v1/cases/${caseId}/${suffix}`, { headers: EDITOR, data });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    return (await response.json()).case as CostingCaseAggregate;
  };

  test.beforeEach(async ({ request }) => {
    const response = await request.post("/api/v1/cases", {
      headers: EDITOR, data: { platformName: `Synthetic duplicate-save test ${crypto.randomUUID()}`, pricingPeriod: "2027-2029" },
    });
    expect(response.status()).toBe(201);
    const created = (await response.json()).case as CostingCaseAggregate;
    caseId = created.costingCase.id;
    capabilityId = created.capabilities[0].id;
  });

  test.afterEach(async ({ request }) => {
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Synthetic duplicate-save test teardown." } });
  });

  test("unchanged PATCH and every wizard/legacy save return the same aggregate without extra audits", async ({ request }) => {
    const initial = await readCase(request, caseId);
    const patch = await request.patch(`/api/v1/cases/${caseId}`, { headers: EDITOR, data: { platformName: initial.costingCase.platformName } });
    expect(patch.status()).toBe(200);
    expect((await patch.json()).case).toEqual(initial);
    const saves: Array<[string, unknown]> = [
      ["capabilities", { capabilities: initial.capabilities }],
      ["step-2", { costs: costs(), income: income() }],
      ["costs", { costs: costs() }], ["income", { income: income() }],
      ["capacity", { capacity: capacity() }], ["proposed-rates", { proposedRates: proposedRates() }],
    ];
    for (const [suffix, data] of saves) {
      const before = await put(request, suffix, data);
      expect(await put(request, suffix, data)).toEqual(before);
      expect(await put(request, suffix, data)).toEqual(before);
    }
  });

  test("maximum-size replay is a no-op, including omitted IDs and equivalent numeric formatting", async ({ request }) => {
    const costRows = costs(200);
    const incomeRows = income(100);
    const before = await put(request, "step-2", { costs: costRows, income: incomeRows });
    expect(before.costs).toHaveLength(200);
    expect(before.income).toHaveLength(100);
    expect(await put(request, "step-2", {
      costs: [...costRows].reverse().map((row) => ({ ...row, id: undefined, amount: "100" })),
      income: [...incomeRows].reverse().map((row) => ({ ...row, id: undefined, amount: "020.0" })),
    })).toEqual(before);
    const changed = await put(request, "step-2", {
      costs: costRows.map((row, index) => index === 199 ? { ...row, justification: "Changed evidence in final chunk." } : row),
      income: incomeRows,
    });
    expect(changed.costs.find((row) => row.id === costRows[199].id)?.justification).toBe("Changed evidence in final chunk.");
    expect(changed.income).toEqual(before.income);
    const addedAudits = changed.auditEvents.filter((event) => !before.auditEvents.some((old) => old.id === event.id));
    expect(addedAudits.map((event) => event.action)).toEqual(["COSTS_SAVED"]);
  });

  test("initial empty save is retained once and no synthetic rows reappear after a page reload", async ({ request, page }) => {
    const before = await put(request, "step-2", { costs: [], income: [] });
    expect(before.auditEvents.filter((event) => event.action === "COSTS_SAVED")).toHaveLength(1);
    expect(before.auditEvents.filter((event) => event.action === "INCOME_SAVED")).toHaveLength(1);
    expect(await put(request, "step-2", { costs: [], income: [] })).toEqual(before);
    await page.goto(`/cases/${caseId}`);
    await page.getByRole("button", { name: /Costs & income/i }).click();
    await expect(page.getByRole("heading", { name: /Capture full operating costs/i })).toBeVisible();
    await expect(page.getByLabel("Cost label")).toHaveCount(0);
    await expect(page.getByLabel("Income source")).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: /Costs & income/i }).click();
    await expect(page.getByRole("heading", { name: /Capture full operating costs/i })).toBeVisible();
    await expect(page.getByLabel("Cost label")).toHaveCount(0);
    await expect(page.getByLabel("Income source")).toHaveCount(0);
    expect(await readCase(request, caseId)).toEqual(before);
  });

  test("validation, role checks and read-only rules still apply to duplicate requests", async ({ request }) => {
    const before = await put(request, "step-2", { costs: costs(), income: income() });
    const url = `/api/v1/cases/${caseId}/step-2`;
    const invalid = await request.put(url, { headers: EDITOR, data: { costs: costs().map((row) => ({ ...row, amount: "-100" })), income: income() } });
    expect(invalid.status()).toBe(400);
    expect((await request.put(url, { headers: REVIEWER, data: { costs: costs(), income: income() } })).status()).toBe(403);
    expect(await readCase(request, caseId)).toEqual(before);
    expect((await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED" } })).status()).toBe(200);
    const archived = await readCase(request, caseId);
    expect((await request.put(url, { headers: EDITOR, data: { costs: costs(), income: income() } })).status()).toBe(409);
    expect(await readCase(request, caseId)).toEqual(archived);
  });

  test("unchanged saves preserve snapshots, real changes remain auditable and block stale submission", async ({ request }) => {
    await put(request, "step-2", { costs: costs(), income: income() });
    await put(request, "capacity", { capacity: capacity() });
    await put(request, "proposed-rates", { proposedRates: proposedRates() });
    expect((await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR })).status()).toBe(201);
    const before = await readCase(request, caseId);
    expect(before.snapshotFreshness).toBe("CURRENT");
    expect(await put(request, "proposed-rates", { proposedRates: proposedRates() })).toEqual(before);

    const after = await put(request, "step-2", { costs: costs().map((row) => ({ ...row, amount: "200" })), income: income() });
    expect(after.snapshotFreshness).toBe("STALE");
    expect(after.snapshots).toEqual(before.snapshots);
    expect(after.auditEvents.filter((event) => event.action === "COSTS_SAVED")).toHaveLength(2);
    expect(after.auditEvents.filter((event) => event.action === "INCOME_SAVED")).toHaveLength(1);
    expect((await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "READY_FOR_REVIEW" } })).status()).toBe(409);
    expect((await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR })).status()).toBe(201);
    expect((await readCase(request, caseId)).snapshots).toHaveLength(2);
  });
});
