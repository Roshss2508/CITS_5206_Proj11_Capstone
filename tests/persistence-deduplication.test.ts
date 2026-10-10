import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import {
  createCase, getCase, saveCapabilities, saveCapacity, saveCosts, saveCostsAndIncome,
  saveIncome, saveProposedRates, transitionStatus, updateCase,
} from "@/src/modules/repository";
import type { Actor, CostLine, IncomeLine } from "@/src/modules/types";

const database = vi.hoisted(() => ({ getDb: vi.fn(), ensureDatabase: vi.fn() }));
vi.mock("@/db", () => database);
const actor: Actor = { id: "dedup-editor", name: "Synthetic editor", role: "EDITOR" };
const migration = readFileSync(new URL("../drizzle/0000_sloppy_titanium_man.sql", import.meta.url), "utf8");
type Query = { sql: string; params: unknown[]; method: string };

describe("defensive persistence for repeated saves", () => {
  let sqlite: DatabaseSync;
  let caseId: string;
  let capabilityId: string;
  let writes: Query[];
  let batches: Query[][];

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(migration);
    writes = [];
    batches = [];
    const execute = (query: Query) => {
      if (query.params.length > 100) throw new Error(`D1 parameter limit exceeded: ${query.params.length}`);
      const statement = sqlite.prepare(query.sql);
      if (query.method === "run") {
        writes.push(query);
        statement.run(...query.params as SQLInputValue[]);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      return { rows: statement.all(...query.params as SQLInputValue[]) };
    };
    database.getDb.mockReturnValue(drizzle(
      async (sql, params, method) => execute({ sql, params, method }),
      async (queries) => {
        batches.push(queries);
        sqlite.exec("BEGIN");
        try {
          const results = queries.map(execute);
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
      { schema },
    ));
    const created = await createCase("Synthetic duplicate-save case", "2027-2029", actor);
    caseId = created.costingCase.id;
    capabilityId = created.capabilities[0].id;
  });

  afterEach(() => {
    sqlite.close();
    vi.clearAllMocks();
  });

  const resetWrites = () => { writes = []; batches = []; };
  const costs = (count = 1): Array<Omit<CostLine, "caseId">> => Array.from({ length: count }, (_, index) => ({
    id: `cost-${index}`, capabilityId, category: "STAFFING", scope: "CAPABILITY",
    label: `Synthetic cost ${index}`, amount: "100.00", justification: "Synthetic cost evidence.",
  }));
  const income = (count = 1): Array<Omit<IncomeLine, "caseId">> => Array.from({ length: count }, (_, index) => ({
    id: `income-${index}`, sourceName: `Synthetic support ${index}`, sourceType: "UWA_SUPPORT",
    amount: "20.00", justification: "Synthetic support evidence.",
  }));
  const capacity = () => [{
    id: "capacity-1", capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "100",
    historicYear1: null, historicYear2: "400", historicYear3: null, justification: "Synthetic forecast evidence.",
  }];
  const rates = () => [{
    id: "rate-1", capabilityId, uwaRate: null, apfrRate: "162", commercialRate: "202.50",
    uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Synthetic pricing evidence.",
  }];
  const countEvents = (events: Array<{ action: string }>, action: string) => events.filter((event) => event.action === action).length;

  it("does not write or audit an unchanged case PATCH, including an empty patch", async () => {
    const before = await updateCase(caseId, { platformName: "Synthetic updated case", currentStep: 2 }, actor);
    resetWrites();
    expect(await updateCase(caseId, { platformName: "Synthetic updated case", currentStep: 2 }, actor)).toEqual(before);
    expect(await updateCase(caseId, {}, actor)).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await updateCase(caseId, { pricingPeriod: "2030-2032" }, actor);
    expect(changed.costingCase.pricingPeriod).toBe("2030-2032");
    expect(countEvents(changed.auditEvents, "CASE_UPDATED")).toBe(2);
  });

  it("does not rewrite unchanged capabilities, but persists a changed name", async () => {
    const initial = await getCase(caseId);
    const before = await saveCapabilities(caseId, initial.capabilities, actor);
    resetWrites();
    expect(await saveCapabilities(caseId, before.capabilities, actor)).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await saveCapabilities(caseId, before.capabilities.map((row) => ({ ...row, name: "Renamed capability" })), actor);
    expect(changed.capabilities[0].name).toBe("Renamed capability");
    expect(countEvents(changed.auditEvents, "CAPABILITIES_SAVED")).toBe(countEvents(before.auditEvents, "CAPABILITIES_SAVED") + 1);
  });

  it.each([[1, 1], [200, 100]])("skips all duplicate writes for %i costs and %i income rows", async (costCount, incomeCount) => {
    const costRows = costs(costCount);
    const incomeRows = income(incomeCount);
    const before = await saveCostsAndIncome(caseId, costRows, incomeRows, actor);
    resetWrites();
    expect(await saveCostsAndIncome(caseId, [...costRows].reverse(), [...incomeRows].reverse(), actor)).toEqual(before);
    expect(await saveCostsAndIncome(caseId, costRows, incomeRows, actor)).toEqual(before);
    expect(writes).toEqual([]);
    expect(batches).toEqual([]);
  });

  it("treats decimal formatting and omitted row IDs as unchanged without losing duplicate rows", async () => {
    const before = await saveCostsAndIncome(caseId, costs(2), income(2), actor);
    resetWrites();
    expect(await saveCostsAndIncome(caseId,
      costs(2).map((row) => ({ ...row, id: undefined, amount: "0100" })),
      income(2).map((row) => ({ ...row, id: undefined, amount: "20.0" })), actor,
    )).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await saveCostsAndIncome(caseId, costs(1), income(2), actor);
    expect(changed.costs).toHaveLength(1);
    expect(countEvents(changed.auditEvents, "COSTS_SAVED")).toBe(2);
  });

  it("records the first explicit empty save once so demonstration defaults stay cleared", async () => {
    const before = await saveCostsAndIncome(caseId, [], [], actor);
    expect(countEvents(before.auditEvents, "COSTS_SAVED")).toBe(1);
    expect(countEvents(before.auditEvents, "INCOME_SAVED")).toBe(1);
    resetWrites();
    expect(await saveCostsAndIncome(caseId, [], [], actor)).toEqual(before);
    expect(writes).toEqual([]);
  });

  it.each(["costs", "income"] as const)("only writes and audits the changed %s collection", async (collection) => {
    const before = await saveCostsAndIncome(caseId, costs(), income(), actor);
    const costRows = costs();
    const incomeRows = income();
    if (collection === "costs") costRows[0].justification = "New cost evidence, unchanged amount.";
    else incomeRows[0].justification = "New support evidence, unchanged amount.";
    resetWrites();
    const changed = await saveCostsAndIncome(caseId, costRows, incomeRows, actor);
    expect(countEvents(changed.auditEvents, collection === "costs" ? "COSTS_SAVED" : "INCOME_SAVED")).toBe(2);
    expect(countEvents(changed.auditEvents, collection === "costs" ? "INCOME_SAVED" : "COSTS_SAVED")).toBe(1);
    expect(changed[collection][0].justification).not.toBe(before[collection][0].justification);
    const unchangedTable = collection === "costs" ? "income_lines" : "cost_lines";
    expect(writes.some((query) => query.sql.includes(`"${unchangedTable}"`))).toBe(false);
    expect(batches).toHaveLength(1);
  });

  it("keeps legacy cost/income endpoints defensive and does not change the other collection", async () => {
    await saveCosts(caseId, costs(), actor);
    const before = await saveIncome(caseId, income(), actor);
    resetWrites();
    expect(await saveCosts(caseId, costs(), actor)).toEqual(before);
    expect(await saveIncome(caseId, income(), actor)).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await saveCosts(caseId, costs().map((row) => ({ ...row, amount: "200" })), actor);
    expect(changed.costs[0].amount).toBe("200");
    expect(changed.income).toEqual(before.income);
    expect(countEvents(changed.auditEvents, "COSTS_SAVED")).toBe(2);
  });

  it("preserves a necessary wizard step update without creating a fake collection change", async () => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const before = await updateCase(caseId, { currentStep: 2 }, actor);
    resetWrites();
    const after = await saveCostsAndIncome(caseId, costs(), income(), actor);
    expect(after.costingCase.currentStep).toBe(3);
    expect(after.auditEvents).toEqual(before.auditEvents);
    expect(writes).toHaveLength(1);
    expect(writes[0].sql).toContain('update "costing_cases"');
  });

  it("does not skip an explicit row identity change or duplicate-ID constraint failure", async () => {
    await saveCostsAndIncome(caseId, costs(2), income(), actor);
    const changed = await saveCosts(caseId, costs(2).map((row, index) => ({ ...row, id: `new-${index}` })), actor);
    expect(changed.costs.map((row) => row.id).sort()).toEqual(["new-0", "new-1"]);
    const before = await getCase(caseId);
    await expect(saveCosts(caseId, costs(2).map((row) => ({ ...row, id: "duplicate-id" })), actor)).rejects.toThrow(/UNIQUE constraint/);
    expect(await getCase(caseId)).toEqual(before);
  });

  it("skips repeated capacity saves but not changed historic values or evidence", async () => {
    const before = await saveCapacity(caseId, capacity(), actor);
    resetWrites();
    expect(await saveCapacity(caseId, capacity().map((row) => ({ ...row, id: undefined, maximumCapacity: "1000.00", historicYear1: "" })), actor)).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await saveCapacity(caseId, capacity().map((row) => ({ ...row, historicYear1: "0", justification: "Updated historic usage evidence." })), actor);
    expect(changed.capacity[0].historicYear1).toBe("0");
    expect(countEvents(changed.auditEvents, "CAPACITY_SAVED")).toBe(2);
  });

  it("skips repeated proposed-rate saves but not zero rates, proportions or justification changes", async () => {
    const before = await saveProposedRates(caseId, rates(), actor);
    resetWrites();
    expect(await saveProposedRates(caseId, rates().map((row) => ({ ...row, uwaRate: "", commercialRate: "202.5" })), actor)).toEqual(before);
    expect(writes).toEqual([]);
    const changed = await saveProposedRates(caseId, rates().map((row) => ({ ...row, uwaRate: "0", uwaSharePct: "50", apfrSharePct: "35", justification: "Updated user-mix evidence." })), actor);
    expect(changed.proposedRates[0].uwaRate).toBe("0");
    expect(changed.proposedRates[0].uwaSharePct).toBe("50");
    expect(countEvents(changed.auditEvents, "PROPOSED_RATES_SAVED")).toBe(2);
  });

  it("still rejects unchanged saves on read-only cases", async () => {
    const before = await saveCostsAndIncome(caseId, costs(), income(), actor);
    await transitionStatus(caseId, "ARCHIVED", actor, "Synthetic archived case.");
    resetWrites();
    await expect(saveCostsAndIncome(caseId, before.costs, before.income, actor)).rejects.toMatchObject({ status: 409 });
    await expect(updateCase(caseId, {}, actor)).rejects.toMatchObject({ status: 409 });
    expect(writes).toEqual([]);
  });

  it("keeps unchanged capability rows untouched during a partial update and retains removal cascades", async () => {
    const first = (await getCase(caseId)).capabilities[0];
    const saved = await saveCapabilities(caseId, [first, { name: "Second capability", billableUnit: "HOUR", active: true, displayOrder: 1 }], actor);
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const second = saved.capabilities.find((row) => row.id !== capabilityId)!;
    resetWrites();
    await saveCapabilities(caseId, [first, { ...second, displayOrder: 2 }], actor);
    expect(writes.filter((query) => query.sql.startsWith('update "capabilities"'))).toHaveLength(1);
    expect(writes.find((query) => query.sql.startsWith('update "capabilities"'))?.params).not.toContain(capabilityId);
    const removed = await saveCapabilities(caseId, [{ ...second, displayOrder: 0 }], actor);
    expect(removed.capabilities.map((row) => row.id)).toEqual([second.id]);
    expect(removed.costs).toEqual([]);
    expect(removed.income).toHaveLength(1);
  });

  it("does not turn a capability replacement with an unknown or omitted ID into a no-op", async () => {
    const first = (await getCase(caseId)).capabilities[0];
    const unknown = await saveCapabilities(caseId, [{ ...first, id: "new-client-id" }], actor);
    expect(unknown.capabilities[0].id).not.toBe(first.id);
    const omitted = await saveCapabilities(caseId, [{ ...first, id: undefined }], actor);
    expect(omitted.capabilities[0].id).not.toBe(unknown.capabilities[0].id);
    expect(countEvents(omitted.auditEvents, "CAPABILITIES_SAVED")).toBe(2);
  });

  it.each([{ billableUnit: "DAY" as const }, { active: false }, { displayOrder: 2 }])(
    "persists each changed capability configuration field: %j", async (change) => {
      const initial = await getCase(caseId);
      await saveCapabilities(caseId, initial.capabilities, actor);
      const changed = await saveCapabilities(caseId, initial.capabilities.map((row) => ({ ...row, ...change })), actor);
      expect(changed.capabilities[0]).toMatchObject(change);
      expect(countEvents(changed.auditEvents, "CAPABILITIES_SAVED")).toBe(1);
    },
  );

  it.each([
    { category: "OTHER" as const }, { scope: "PLATFORM" as const, capabilityId: null },
    { label: "Updated cost label" }, { amount: "101" }, { justification: "Updated cost justification." },
  ])("does not skip a real cost change: %j", async (change) => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const after = await saveCostsAndIncome(caseId, costs().map((row) => ({ ...row, ...change })), income(), actor);
    expect(after.costs[0]).toMatchObject(change);
    expect(countEvents(after.auditEvents, "COSTS_SAVED")).toBe(2);
    expect(countEvents(after.auditEvents, "INCOME_SAVED")).toBe(1);
  });

  it.each([
    { sourceName: "Updated support source" }, { sourceType: "NON_UWA_SUPPORT" as const },
    { amount: "21" }, { justification: "Updated support justification." },
  ])("does not skip a real support change: %j", async (change) => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const after = await saveCostsAndIncome(caseId, costs(), income().map((row) => ({ ...row, ...change })), actor);
    expect(after.income[0]).toMatchObject(change);
    expect(countEvents(after.auditEvents, "INCOME_SAVED")).toBe(2);
    expect(countEvents(after.auditEvents, "COSTS_SAVED")).toBe(1);
  });

  it("validates capability ownership before checking for unchanged content", async () => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const other = await createCase("Synthetic other case", "2027-2029", actor);
    const before = await getCase(caseId);
    resetWrites();
    await expect(saveCosts(caseId, costs().map((row) => ({ ...row, capabilityId: other.capabilities[0].id })), actor)).rejects.toMatchObject({ status: 400 });
    expect(await getCase(caseId)).toEqual(before);
    expect(writes).toEqual([]);
  });

  it("can clear previously populated collections once and then skip repeated clearing", async () => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const cleared = await saveCostsAndIncome(caseId, [], [], actor);
    expect(cleared.costs).toEqual([]);
    expect(cleared.income).toEqual([]);
    expect(countEvents(cleared.auditEvents, "COSTS_SAVED")).toBe(2);
    expect(countEvents(cleared.auditEvents, "INCOME_SAVED")).toBe(2);
    resetWrites();
    expect(await saveCostsAndIncome(caseId, [], [], actor)).toEqual(cleared);
    expect(writes).toEqual([]);
  });

  it("rolls back a changed collection's late failure even when the other collection is a no-op", async () => {
    await saveCostsAndIncome(caseId, costs(), income(), actor);
    const before = await updateCase(caseId, { currentStep: 2 }, actor);
    const incomeRows = income(100);
    incomeRows[99].id = incomeRows[0].id;
    resetWrites();
    await expect(saveCostsAndIncome(caseId, costs(), incomeRows, actor)).rejects.toThrow(/UNIQUE constraint/);
    expect(await getCase(caseId)).toEqual(before);
    expect(batches).toHaveLength(1);
    expect(writes.some((query) => query.sql.includes('"cost_lines"'))).toBe(false);
  });

  it.each([
    { maximumCapacity: "1200" }, { forecastUtilisationPct: "50" }, { historicYear1: "1" },
    { historicYear2: "401" }, { historicYear3: "3" }, { justification: "New forecast evidence." },
  ])("persists each changed capacity/evidence field: %j", async (change) => {
    await saveCapacity(caseId, capacity(), actor);
    const changed = await saveCapacity(caseId, capacity().map((row) => ({ ...row, ...change })), actor);
    expect(changed.capacity[0]).toMatchObject(change);
    expect(countEvents(changed.auditEvents, "CAPACITY_SAVED")).toBe(2);
  });

  it.each([
    { uwaRate: "0" }, { apfrRate: "163" }, { commercialRate: "205" },
    { uwaSharePct: "50", apfrSharePct: "35" }, { uwaSharePct: "50", commercialSharePct: "25" },
    { justification: "New pricing evidence." },
  ])("persists each changed rate/user-mix/evidence field: %j", async (change) => {
    await saveProposedRates(caseId, rates(), actor);
    const changed = await saveProposedRates(caseId, rates().map((row) => ({ ...row, ...change })), actor);
    expect(changed.proposedRates[0]).toMatchObject(change);
    expect(countEvents(changed.auditEvents, "PROPOSED_RATES_SAVED")).toBe(2);
  });
});
