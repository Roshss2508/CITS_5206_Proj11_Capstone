import { expect, test, type APIRequestContext } from "@playwright/test";
import type { CalculationResult, CalculationSnapshot, CostingCaseAggregate } from "../../src/modules/types";

const EDITOR = { "x-demo-role": "EDITOR" };
const REVIEWER = { "x-demo-role": "REVIEWER" };

test.describe("Issue #69 integrated backend release readiness", () => {
  let caseId: string;
  let capabilityId: string;
  let createdIds: string[];
  const base = () => `/api/v1/cases/${caseId}`;
  const capacity = (id = capabilityId) => ({
    capabilityId: id, maximumCapacity: "2000", forecastUtilisationPct: "50",
    historicYear1: "800", historicYear2: null, historicYear3: "900", justification: "Synthetic forecast evidence.",
  });
  const rate = (id = capabilityId) => ({
    capabilityId: id, uwaRate: null, apfrRate: null, commercialRate: null,
    uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Synthetic pricing evidence.",
  });
  const cost = (id = capabilityId) => ({
    capabilityId: id, scope: "CAPABILITY", category: "MAINTENANCE", label: "Synthetic maintenance",
    amount: "100000", justification: "Synthetic annual maintenance evidence.",
  });
  const income = () => [
    { sourceName: "Synthetic UWA", sourceType: "UWA_SUPPORT", amount: "20000", justification: "Synthetic recurring support." },
    { sourceName: "Synthetic external", sourceType: "NON_UWA_SUPPORT", amount: "30000", justification: "Synthetic recurring support." },
  ];

  async function read(request: APIRequestContext): Promise<CostingCaseAggregate> {
    const response = await request.get(base());
    expect(response.status()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    return (await response.json()).case;
  }

  async function put(request: APIRequestContext, path: string, data: unknown): Promise<CostingCaseAggregate> {
    const response = await request.put(`${base()}/${path}`, { headers: EDITOR, data });
    expect(response.status(), await response.text()).toBe(200);
    expect(response.headers()["cache-control"]).toBe("no-store");
    return (await response.json()).case;
  }

  async function seedGolden(request: APIRequestContext) {
    await put(request, "step-2", { costs: [cost(), { ...cost(), capabilityId: null, scope: "PLATFORM", category: "STAFFING", label: "Synthetic shared staff", amount: "50000" }], income: income() });
    await put(request, "capacity", { capacity: [capacity()] });
    return put(request, "proposed-rates", { proposedRates: [rate()] });
  }

  test.beforeEach(async ({ request }) => {
    createdIds = [];
    const response = await request.post("/api/v1/cases", {
      headers: EDITOR, data: { platformName: `Synthetic readiness ${crypto.randomUUID()}`, pricingPeriod: "2027-2029" },
    });
    expect(response.status()).toBe(201);
    const created = (await response.json()).case as CostingCaseAggregate;
    caseId = created.costingCase.id;
    capabilityId = created.capabilities[0].id;
    createdIds.push(caseId);
  });

  test.afterEach(async ({ request }) => {
    for (const id of createdIds) {
      await request.post(`/api/v1/cases/${id}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Synthetic readiness test teardown." } });
    }
  });

  test("persisted Golden Case calculates exact rates and freezes the same inputs and results", async ({ request }) => {
    const saved = await seedGolden(request);
    const response = await request.post(`${base()}/calculate`, { headers: EDITOR });
    expect(response.status()).toBe(201);
    expect(response.headers()["cache-control"]).toBe("no-store");
    const { result, snapshot } = await response.json() as { result: CalculationResult; snapshot: CalculationSnapshot };
    expect(result).toMatchObject({ formulaVersion: "RIC_FORMULA_V1", grossRevenue: "130875.00", universityOverhead: "18375.00", netPlatformRecovery: "112500.00", operatingBalance: "12500.00", warnings: [] });
    expect(result.capabilities).toHaveLength(1);
    expect(result.capabilities[0]).toMatchObject({ forecastUnits: "1000.000000", totalOperatingCost: "150000.00", allocatedUwaSupport: "20000.00", allocatedNonUwaSupport: "30000.00", sustainableRates: { UWA: "100.00", APFR: "162.00", COMMERCIAL: "202.50" }, overheadComponents: { APFR: "42.00", COMMERCIAL: "52.50" } });
    expect(snapshot).toMatchObject({ caseId, formulaVersion: "RIC_FORMULA_V1", createdBy: "demo-editor", createdAt: result.calculatedAt });
    expect(JSON.parse(snapshot.outputJson)).toEqual(result);
    const inputs = JSON.parse(snapshot.inputJson);
    for (const key of ["costingCase", "capabilities", "costs", "income", "capacity", "proposedRates"] as const) expect(inputs[key]).toEqual(saved[key]);
    const before = await read(request);
    expect(before.snapshots).toEqual([snapshot]);
    expect(before.snapshotFreshness).toBe("CURRENT");
    expect(await put(request, "proposed-rates", { proposedRates: before.proposedRates })).toEqual(before);
    const changed = await put(request, "proposed-rates", { proposedRates: before.proposedRates.map((row) => ({ ...row, uwaRate: "120" })) });
    expect(changed.snapshotFreshness).toBe("STALE");
    expect(changed.snapshots).toEqual([snapshot]);
    const recalculated = await request.post(`${base()}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const next = (await recalculated.json()).result as CalculationResult;
    expect(next.capabilities[0].sustainableRates).toEqual(result.capabilities[0].sustainableRates);
    expect(next).toMatchObject({ grossRevenue: "142875.00", universityOverhead: "18375.00", netPlatformRecovery: "124500.00", operatingBalance: "24500.00" });
    const after = await read(request);
    expect(after.snapshots).toHaveLength(2);
    expect(after.snapshots.find((row) => row.id === snapshot.id)).toEqual(snapshot);
    expect(after.auditEvents.filter((row) => row.action === "CALCULATION_SNAPSHOT_CREATED")).toHaveLength(2);
    expect(after.auditEvents.filter((row) => row.action === "PROPOSED_RATES_SAVED")).toHaveLength(2);
  });

  test("all 20 capabilities save, calculate and duplicate with maximum Step 2 collections", async ({ request }) => {
    const configured = await put(request, "capabilities", { capabilities: Array.from({ length: 20 }, (_, index) => ({
      id: index === 0 ? capabilityId : undefined, name: `Synthetic capability ${index}`, billableUnit: "HOUR", active: true, displayOrder: index,
    })) });
    const ids = configured.capabilities.map((row) => row.id);
    await put(request, "step-2", {
      costs: Array.from({ length: 200 }, (_, index) => ({ ...cost(ids[index % 20]), label: `Synthetic cost ${index}`, amount: "1000" })),
      income: Array.from({ length: 100 }, (_, index) => ({ ...income()[index % 2], sourceName: `Synthetic support ${index}`, amount: "100" })),
    });
    await put(request, "capacity", { capacity: ids.map((id) => capacity(id)) });
    const saved = await put(request, "proposed-rates", { proposedRates: ids.map((id) => rate(id)) });
    expect(saved.capacity).toHaveLength(20);
    expect(saved.proposedRates).toHaveLength(20);
    const calculated = await request.post(`${base()}/calculate`, { headers: EDITOR });
    expect(calculated.status()).toBe(201);
    const result = (await calculated.json()).result as CalculationResult;
    expect(result.capabilities).toHaveLength(20);
    for (const row of result.capabilities) expect(row).toMatchObject({ totalOperatingCost: "10000.00", allocatedUwaSupport: "250.00", allocatedNonUwaSupport: "250.00", forecastUnits: "1000.000000", sustainableRates: { UWA: "9.50", APFR: "13.16", COMMERCIAL: "13.50" } });
    const original = await read(request);
    const duplicated = await request.post(`${base()}/duplicate`, { headers: EDITOR });
    expect(duplicated.status()).toBe(201);
    const copy = (await duplicated.json()).case as CostingCaseAggregate;
    createdIds.push(copy.costingCase.id);
    expect(copy.costingCase.status).toBe("DRAFT");
    expect(copy.snapshotFreshness).toBe("NONE");
    expect(copy.snapshots).toEqual([]);
    for (const key of ["capabilities", "costs", "income", "capacity", "proposedRates"] as const) expect(copy[key]).toHaveLength(original[key].length);
    expect(await read(request)).toEqual(original);
    const copyCalculated = await request.post(`/api/v1/cases/${copy.costingCase.id}/calculate`, { headers: EDITOR });
    expect(copyCalculated.status()).toBe(201);
    const copyResult = (await copyCalculated.json()).result as CalculationResult;
    for (const key of ["grossRevenue", "universityOverhead", "netPlatformRecovery", "operatingBalance"] as const) expect(copyResult[key]).toBe(result[key]);
  });

  for (const collection of ["capacity", "proposed-rates"] as const) {
    test(`failed ${collection} replacement preserves the entire original aggregate`, async ({ request }) => {
      await seedGolden(request);
      const before = await read(request);
      const rows = collection === "capacity" ? before.capacity : before.proposedRates;
      const failed = await request.put(`${base()}/${collection}`, { headers: EDITOR, data: { [collection === "capacity" ? "capacity" : "proposedRates"]: [rows[0], rows[0]] } });
      expect(failed.status()).toBe(500);
      expect(await read(request)).toEqual(before);
    });
  }

  test("important validation, role, missing-case and review errors preserve persisted data", async ({ request }) => {
    const before = await seedGolden(request);
    const failures: Array<[string, unknown]> = [
      ["step-2", { costs: [{ ...cost(), amount: "-1" }], income: income() }],
      ["step-2", { costs: [cost()], income: [{ ...income()[0], amount: "-1" }] }],
      ["step-2", { costs: Array.from({ length: 201 }, () => cost()), income: [] }],
      ["step-2", { costs: [], income: Array.from({ length: 101 }, () => income()[0]) }],
      ["step-2", { costs: [cost("unknown-capability")], income: income() }],
      ["capacity", { capacity: [{ ...capacity(), forecastUtilisationPct: "0" }] }],
      ["capacity", { capacity: [{ ...capacity(), forecastUtilisationPct: "101" }] }],
      ["proposed-rates", { proposedRates: [{ ...rate(), commercialSharePct: "14.99" }] }],
    ];
    for (const [path, data] of failures) {
      const response = await request.put(`${base()}/${path}`, { headers: EDITOR, data });
      expect(response.status(), path).toBe(400);
      expect((await response.json()).error).toEqual(expect.any(String));
      expect(await read(request)).toEqual(before);
    }
    for (const [path, data] of [["step-2", { costs: [cost()], income: income() }], ["capacity", { capacity: [capacity()] }], ["proposed-rates", { proposedRates: [rate()] }]] as const) {
      expect((await request.put(`${base()}/${path}`, { headers: REVIEWER, data })).status()).toBe(403);
    }
    expect((await request.post(`${base()}/calculate`, { headers: REVIEWER })).status()).toBe(403);
    expect((await request.post(`${base()}/status`, { headers: EDITOR, data: { status: "READY_FOR_REVIEW" } })).status()).toBe(409);
    const missing = `/api/v1/cases/missing-${crypto.randomUUID()}`;
    expect((await request.get(missing)).status()).toBe(404);
    expect((await request.put(`${missing}/step-2`, { headers: EDITOR, data: { costs: [], income: [] } })).status()).toBe(404);
    expect(await read(request)).toEqual(before);
    expect((await request.post(`${base()}/status`, { headers: EDITOR, data: { status: "ARCHIVED" } })).status()).toBe(200);
    const archived = await read(request);
    expect((await request.put(`${base()}/capacity`, { headers: EDITOR, data: { capacity: [capacity()] } })).status()).toBe(409);
    expect((await request.post(`${base()}/calculate`, { headers: EDITOR })).status()).toBe(409);
    expect(await read(request)).toEqual(archived);
  });
});
