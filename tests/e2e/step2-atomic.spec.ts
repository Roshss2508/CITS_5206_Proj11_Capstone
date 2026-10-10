import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

async function createCase(request: APIRequestContext) {
  const response = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Atomic Step 2 ${crypto.randomUUID()}`, pricingPeriod: "2027-2029" },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return { caseId: body.case.costingCase.id as string, capabilityId: body.case.capabilities[0].id as string };
}

const cost = (capabilityId: string, id: string, amount: string) => ({
  id: `${capabilityId}-${id}`, capabilityId, category: "STAFFING", scope: "CAPABILITY",
  label: "Technician staffing", amount, justification: "Synthetic test cost.",
});

const income = (caseId: string, id: string, amount: string) => ({
  id: `${caseId}-${id}`, sourceName: "Recurrent support", sourceType: "UWA_SUPPORT",
  amount, justification: "Synthetic test support.",
});

async function readCase(request: APIRequestContext, caseId: string) {
  const response = await request.get(`/api/v1/cases/${caseId}`);
  expect(response.status()).toBe(200);
  return (await response.json()).case;
}

test.describe("atomic Step 2 persistence", () => {
  let caseId: string;
  let capabilityId: string;

  test.beforeEach(async ({ request }) => {
    ({ caseId, capabilityId } = await createCase(request));
  });

  test.afterEach(async ({ request }) => {
    await request.post(`/api/v1/cases/${caseId}/status`, {
      headers: EDITOR,
      data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." },
    });
  });

  test("replaces costs and income together, including empty collections", async ({ request }) => {
    const url = `/api/v1/cases/${caseId}/step-2`;
    const replacement = await request.put(url, {
      headers: EDITOR,
      data: { costs: [cost(capabilityId, "cost-a", "100"), cost(capabilityId, "cost-b", "200")], income: [income(caseId, "income-a", "30")] },
    });
    expect(replacement.status()).toBe(200);
    const saved = await readCase(request, caseId);
    expect(saved.costs.map((row: { amount: string }) => row.amount).sort()).toEqual(["100", "200"]);
    expect(saved.income.map((row: { amount: string }) => row.amount)).toEqual(["30"]);
    expect(saved.costingCase.currentStep).toBe(3);
    expect(saved.auditEvents.filter((event: { action: string }) => ["COSTS_SAVED", "INCOME_SAVED"].includes(event.action))).toHaveLength(2);

    const cleared = await request.put(url, { headers: EDITOR, data: { costs: [], income: [] } });
    expect(cleared.status()).toBe(200);
    const empty = await readCase(request, caseId);
    expect(empty.costs).toEqual([]);
    expect(empty.income).toEqual([]);
  });

  test("rolls back both collections, timestamp and audit when a later insert fails", async ({ request }) => {
    const url = `/api/v1/cases/${caseId}/step-2`;
    expect((await request.put(url, {
      headers: EDITOR,
      data: { costs: [cost(capabilityId, "original-cost", "100")], income: [income(caseId, "original-income", "30")] },
    })).status()).toBe(200);
    const before = await readCase(request, caseId);

    // The duplicate income primary key fails after the batch has deleted and
    // inserted costs. A transactional batch must restore the entire prior state.
    const failed = await request.put(url, {
      headers: EDITOR,
      data: {
        costs: [cost(capabilityId, "replacement-cost", "999")],
        income: [income(caseId, "duplicate-income", "40"), income(caseId, "duplicate-income", "50")],
      },
    });
    expect(failed.status()).toBe(500);
    const after = await readCase(request, caseId);
    expect(after.costs).toEqual(before.costs);
    expect(after.income).toEqual(before.income);
    expect(after.costingCase.updatedAt).toBe(before.costingCase.updatedAt);
    expect(after.auditEvents).toEqual(before.auditEvents);
  });

  test("rejects invalid income before changing valid costs", async ({ request }) => {
    const url = `/api/v1/cases/${caseId}/step-2`;
    expect((await request.put(url, {
      headers: EDITOR,
      data: { costs: [cost(capabilityId, "original-cost", "100")], income: [income(caseId, "original-income", "30")] },
    })).status()).toBe(200);
    const before = await readCase(request, caseId);

    const failed = await request.put(url, {
      headers: EDITOR,
      data: { costs: [cost(capabilityId, "replacement-cost", "999")], income: [income(caseId, "invalid-income", "-1")] },
    });
    expect(failed.status()).toBe(400);
    const after = await readCase(request, caseId);
    expect(after.costs).toEqual(before.costs);
    expect(after.income).toEqual(before.income);
    expect(after.auditEvents).toEqual(before.auditEvents);
  });

  test("keeps legacy cost and income endpoints atomic independently", async ({ request }) => {
    const costsUrl = `/api/v1/cases/${caseId}/costs`;
    const incomeUrl = `/api/v1/cases/${caseId}/income`;
    expect((await request.put(costsUrl, { headers: EDITOR, data: { costs: [cost(capabilityId, "old-cost", "100")] } })).status()).toBe(200);
    expect((await request.put(incomeUrl, { headers: EDITOR, data: { income: [income(caseId, "old-income", "30")] } })).status()).toBe(200);
    const before = await readCase(request, caseId);

    expect((await request.put(costsUrl, { headers: EDITOR, data: {
      costs: [cost(capabilityId, "duplicate-cost", "1"), cost(capabilityId, "duplicate-cost", "2")],
    } })).status()).toBe(500);
    expect((await request.put(incomeUrl, { headers: EDITOR, data: {
      income: [income(caseId, "duplicate-income", "1"), income(caseId, "duplicate-income", "2")],
    } })).status()).toBe(500);
    const after = await readCase(request, caseId);
    expect(after.costs).toEqual(before.costs);
    expect(after.income).toEqual(before.income);
    expect(after.auditEvents).toEqual(before.auditEvents);
  });

  test("replaces and clears maximum-size collections across 20 capabilities", async ({ request }) => {
    const capabilityResponse = await request.put(`/api/v1/cases/${caseId}/capabilities`, {
      headers: EDITOR,
      data: {
        capabilities: Array.from({ length: 20 }, (_, index) => ({
          id: index === 0 ? capabilityId : undefined, name: `Synthetic capability ${index}`,
          billableUnit: "HOUR", active: true, displayOrder: index,
        })),
      },
    });
    expect(capabilityResponse.status()).toBe(200);
    const capabilityIds = (await capabilityResponse.json()).case.capabilities.map((row: { id: string }) => row.id);
    const costs = Array.from({ length: 200 }, (_, index) => ({
      ...cost(capabilityIds[index % 20], `large-cost-${index}`, `${index + 1}.23`),
      label: `Synthetic cost ${index}`, justification: `Synthetic cost evidence ${index}.`,
    }));
    const incomes = Array.from({ length: 100 }, (_, index) => ({
      ...income(caseId, `large-income-${index}`, `${index + 1}.45`),
      sourceName: `Synthetic support ${index}`, sourceType: index % 2 === 0 ? "UWA_SUPPORT" : "NON_UWA_SUPPORT",
    }));
    const url = `/api/v1/cases/${caseId}/step-2`;
    const response = await request.put(url, { headers: EDITOR, data: { costs, income: incomes } });
    expect(response.status()).toBe(200);
    const saved = await readCase(request, caseId);
    expect(saved.costs).toHaveLength(200);
    expect(saved.costs).toEqual(expect.arrayContaining(costs.map((row) => ({ ...row, caseId }))));
    expect(saved.income).toHaveLength(100);
    expect(saved.income).toEqual(expect.arrayContaining(incomes.map((row) => ({ ...row, caseId }))));
    expect(saved.auditEvents.filter((event: { action: string }) => event.action === "COSTS_SAVED")).toHaveLength(1);
    expect(saved.auditEvents.filter((event: { action: string }) => event.action === "INCOME_SAVED")).toHaveLength(1);

    expect((await request.put(url, { headers: EDITOR, data: { costs: [], income: [] } })).status()).toBe(200);
    const cleared = await readCase(request, caseId);
    expect(cleared.costs).toEqual([]);
    expect(cleared.income).toEqual([]);
  });

  for (const collection of ["costs", "income"] as const) {
    test(`rolls back all chunks when the final ${collection} insert fails`, async ({ request }) => {
      const url = `/api/v1/cases/${caseId}/step-2`;
      expect((await request.put(url, {
        headers: EDITOR,
        data: { costs: [cost(capabilityId, "original-cost", "100")], income: [income(caseId, "original-income", "30")] },
      })).status()).toBe(200);
      expect((await request.patch(`/api/v1/cases/${caseId}`, { headers: EDITOR, data: { currentStep: 2 } })).status()).toBe(200);
      const before = await readCase(request, caseId);
      const costs = Array.from({ length: 200 }, (_, index) => cost(capabilityId, `replacement-cost-${index}`, `${index + 1}`));
      const incomes = Array.from({ length: 100 }, (_, index) => income(caseId, `replacement-income-${index}`, `${index + 1}`));
      const rows = collection === "costs" ? costs : incomes;
      rows[rows.length - 1].id = rows[0].id;

      const response = await request.put(url, { headers: EDITOR, data: { costs, income: incomes } });
      expect(response.status()).toBe(500);
      // Compare the complete persisted aggregate: both collections, the step,
      // timestamp, audit history and unrelated data must remain unchanged.
      expect(await readCase(request, caseId)).toEqual(before);
    });
  }

  test("handles maximum-size legacy saves and rolls back a later chunk failure", async ({ request }) => {
    const costs = Array.from({ length: 200 }, (_, index) => cost(capabilityId, `legacy-cost-${index}`, `${index + 1}`));
    const incomes = Array.from({ length: 100 }, (_, index) => income(caseId, `legacy-income-${index}`, `${index + 1}`));
    const costsUrl = `/api/v1/cases/${caseId}/costs`;
    const incomeUrl = `/api/v1/cases/${caseId}/income`;
    expect((await request.put(costsUrl, { headers: EDITOR, data: { costs } })).status()).toBe(200);
    expect((await request.put(incomeUrl, { headers: EDITOR, data: { income: incomes } })).status()).toBe(200);
    const before = await readCase(request, caseId);
    expect(before.costs).toHaveLength(200);
    expect(before.costs).toEqual(expect.arrayContaining(costs.map((row) => ({ ...row, caseId }))));
    expect(before.income).toHaveLength(100);
    expect(before.income).toEqual(expect.arrayContaining(incomes.map((row) => ({ ...row, caseId }))));

    costs[costs.length - 1].id = costs[0].id;
    incomes[incomes.length - 1].id = incomes[0].id;
    expect((await request.put(costsUrl, { headers: EDITOR, data: { costs } })).status()).toBe(500);
    expect(await readCase(request, caseId)).toEqual(before);
    expect((await request.put(incomeUrl, { headers: EDITOR, data: { income: incomes } })).status()).toBe(500);
    expect(await readCase(request, caseId)).toEqual(before);
  });
});
