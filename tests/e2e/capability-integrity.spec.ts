import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

type CaseSeed = { caseId: string; capabilityId: string };

async function createCase(request: APIRequestContext, name: string): Promise<CaseSeed> {
  const response = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: name, pricingPeriod: "2027-2029" },
  });
  expect(response.status()).toBe(201);
  const body = await response.json();
  return {
    caseId: body.case.costingCase.id as string,
    capabilityId: body.case.capabilities[0].id as string,
  };
}

async function expectCapabilityError(response: Awaited<ReturnType<APIRequestContext["put"]>>) {
  expect(response.status()).toBe(400);
  const body = await response.json();
  const messages = [
    body.error,
    ...(body.issues || []).map((issue: { message?: string }) => issue.message),
  ].filter(Boolean).join(" ");
  expect(messages).toMatch(/capability/i);
}

test.describe("capability-linked record integrity", () => {
  let current: CaseSeed;
  let other: CaseSeed;

  test.beforeEach(async ({ request }) => {
    const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    current = await createCase(request, `QA Capability Case A ${suffix}`);
    other = await createCase(request, `QA Capability Case B ${suffix}`);
  });

  test.afterEach(async ({ request }) => {
    for (const item of [current, other]) {
      if (!item) continue;
      await request.post(`/api/v1/cases/${item.caseId}/status`, {
        headers: EDITOR,
        data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." },
      });
    }
  });

  test("rejects inconsistent cost scope and capability ID combinations", async ({ request }) => {
    const missingCapability = await request.put(`/api/v1/cases/${current.caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: null, category: "OTHER", scope: "CAPABILITY", label: "Direct cost", amount: "100", justification: "Missing capability reference." }] },
    });
    await expectCapabilityError(missingCapability);

    const unexpectedCapability = await request.put(`/api/v1/cases/${current.caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: current.capabilityId, category: "OTHER", scope: "PLATFORM", label: "Shared cost", amount: "100", justification: "Unexpected capability reference." }] },
    });
    await expectCapabilityError(unexpectedCapability);
  });

  test("rejects unknown and cross-case capability IDs before replacing existing records", async ({ request }) => {
    const validCost = { capabilityId: current.capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Valid staffing", amount: "100", justification: "Valid current-case capability." };
    const validCapacity = { capabilityId: current.capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Valid current-case capability." };
    const validRate = { capabilityId: current.capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Valid current-case capability." };

    expect((await request.put(`/api/v1/cases/${current.caseId}/costs`, { headers: EDITOR, data: { costs: [validCost] } })).status()).toBe(200);
    expect((await request.put(`/api/v1/cases/${current.caseId}/capacity`, { headers: EDITOR, data: { capacity: [validCapacity] } })).status()).toBe(200);
    expect((await request.put(`/api/v1/cases/${current.caseId}/proposed-rates`, { headers: EDITOR, data: { proposedRates: [validRate] } })).status()).toBe(200);

    await expectCapabilityError(await request.put(`/api/v1/cases/${current.caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ ...validCost, capabilityId: other.capabilityId }] },
    }));
    await expectCapabilityError(await request.put(`/api/v1/cases/${current.caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ ...validCapacity, capabilityId: "unknown-capability" }] },
    }));
    await expectCapabilityError(await request.put(`/api/v1/cases/${current.caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ ...validRate, capabilityId: other.capabilityId }] },
    }));

    const saved = await request.get(`/api/v1/cases/${current.caseId}`);
    expect(saved.status()).toBe(200);
    const body = await saved.json();
    expect(body.case.costs).toHaveLength(1);
    expect(body.case.costs[0]).toMatchObject({ capabilityId: current.capabilityId, amount: "100" });
    expect(body.case.capacity).toHaveLength(1);
    expect(body.case.capacity[0]).toMatchObject({ capabilityId: current.capabilityId, maximumCapacity: "1000" });
    expect(body.case.proposedRates).toHaveLength(1);
    expect(body.case.proposedRates[0]).toMatchObject({ capabilityId: current.capabilityId, uwaSharePct: "60" });
  });
});
