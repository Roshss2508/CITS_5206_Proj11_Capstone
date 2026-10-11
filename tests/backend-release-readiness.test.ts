import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { calculateCase } from "@/src/modules/calculation";
import {
  createCase, createSnapshot, duplicateCase, getCase, listCases, saveCapabilities,
  saveCapacity, saveCostsAndIncome, saveProposedRates,
} from "@/src/modules/repository";
import type { Actor } from "@/src/modules/types";

const database = vi.hoisted(() => ({ getDb: vi.fn(), ensureDatabase: vi.fn() }));
vi.mock("@/db", () => database);
const actor: Actor = { id: "readiness-editor", name: "Synthetic editor", role: "EDITOR" };
const migration = readFileSync(new URL("../drizzle/0000_sloppy_titanium_man.sql", import.meta.url), "utf8");
type Query = { sql: string; params: unknown[]; method: string };

describe("Issue #69 integrated backend release boundaries", () => {
  let sqlite: DatabaseSync;
  let caseId: string;
  let queries: Query[];
  let batches: Query[][];

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(migration);
    queries = [];
    batches = [];
    const execute = (query: Query) => {
      queries.push(query);
      // An independent hosted-D1 limit, not the application's chunk constant.
      if (query.params.length > 100) throw new Error(`D1 parameter limit exceeded: ${query.params.length}`);
      const statement = sqlite.prepare(query.sql);
      if (query.method === "run") {
        statement.run(...query.params as SQLInputValue[]);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      return { rows: statement.all(...query.params as SQLInputValue[]) };
    };
    database.getDb.mockReturnValue(drizzle(
      async (sql, params, method) => execute({ sql, params, method }),
      async (items) => {
        batches.push(items);
        sqlite.exec("BEGIN");
        try {
          const results = items.map(execute);
          sqlite.exec("COMMIT");
          return results;
        } catch (error) {
          sqlite.exec("ROLLBACK");
          throw error;
        }
      },
      { schema },
    ));
    caseId = (await createCase("Synthetic release boundary", "2027-2029", actor)).costingCase.id;
  });

  afterEach(() => {
    sqlite.close();
    vi.clearAllMocks();
  });

  async function capabilityRows(count: number) {
    const initial = await getCase(caseId);
    return (await saveCapabilities(caseId, Array.from({ length: count }, (_, index) => ({
      id: index === 0 ? initial.capabilities[0].id : undefined,
      name: `Synthetic capability ${index}`, billableUnit: "HOUR", active: true, displayOrder: index,
    })), actor)).capabilities;
  }

  const capacityRows = (ids: string[]) => ids.map((capabilityId, index) => ({
    id: `capacity-${index}`, capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "100",
    historicYear1: "700", historicYear2: null, historicYear3: "900", justification: `Synthetic capacity evidence ${index}.`,
  }));
  const rateRows = (ids: string[]) => ids.map((capabilityId, index) => ({
    id: `rate-${index}`, capabilityId, uwaRate: null, apfrRate: null, commercialRate: null,
    uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: `Synthetic pricing evidence ${index}.`,
  }));
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

  it.each([10, 11, 12, 20])("saves and replays all capacity fields for %i capabilities within 100 binds", async (count) => {
    const ids = (await capabilityRows(count)).map((row) => row.id);
    const capacity = capacityRows(ids);
    batches = [];
    const capacitySaved = await saveCapacity(caseId, capacity, actor);
    expect(byId(capacitySaved.capacity)).toEqual(byId(capacity.map((row) => ({ ...row, caseId }))));
    expect(capacitySaved.auditEvents.filter((row) => row.action === "CAPACITY_SAVED")).toHaveLength(1);
    expect(batches).toHaveLength(1);
    expect(await saveCapacity(caseId, capacity, actor)).toEqual(capacitySaved);
    expect(batches).toHaveLength(1);
    expect(queries.every((query) => query.params.length <= 100)).toBe(true);
  });

  it.each([10, 11, 12, 20])("saves and replays all rate fields for %i capabilities within 100 binds", async (count) => {
    const ids = (await capabilityRows(count)).map((row) => row.id);
    const rates = rateRows(ids);
    batches = [];
    const ratesSaved = await saveProposedRates(caseId, rates, actor);
    expect(byId(ratesSaved.proposedRates)).toEqual(byId(rates.map((row) => ({ ...row, caseId }))));
    expect(ratesSaved.auditEvents.filter((row) => row.action === "PROPOSED_RATES_SAVED")).toHaveLength(1);
    expect(batches).toHaveLength(1);
    expect(await saveProposedRates(caseId, rates, actor)).toEqual(ratesSaved);
    expect(batches).toHaveLength(1);
    expect(queries.every((query) => query.params.length <= 100)).toBe(true);
  });

  it.each(["capacity", "rates"] as const)("rolls back %s replacement, timestamp and audit on a late audit failure", async (collection) => {
    const ids = (await capabilityRows(2)).map((row) => row.id);
    await saveCapacity(caseId, capacityRows(ids), actor);
    await saveProposedRates(caseId, rateRows(ids), actor);
    const before = await getCase(caseId);
    const action = collection === "capacity" ? "CAPACITY_SAVED" : "PROPOSED_RATES_SAVED";
    sqlite.exec(`CREATE TRIGGER fail_audit BEFORE INSERT ON audit_events
      WHEN NEW.action = '${action}' BEGIN SELECT RAISE(ABORT, 'Synthetic late audit failure'); END`);
    const save = collection === "capacity"
      ? saveCapacity(caseId, capacityRows(ids).map((row) => ({ ...row, maximumCapacity: "2000" })), actor)
      : saveProposedRates(caseId, rateRows(ids).map((row) => ({ ...row, uwaRate: "120" })), actor);
    await expect(save).rejects.toThrow();
    expect(await getCase(caseId)).toEqual(before);
  });

  it.each(["capacity", "rates"] as const)("rolls back all chunks on a final %s primary-key collision", async (collection) => {
    const ids = (await capabilityRows(20)).map((row) => row.id);
    await saveCapacity(caseId, capacityRows(ids), actor);
    await saveProposedRates(caseId, rateRows(ids), actor);
    const before = await getCase(caseId);
    const capacity = capacityRows(ids).map((row) => ({ ...row, maximumCapacity: "2000" }));
    const rates = rateRows(ids).map((row) => ({ ...row, uwaRate: "120" }));
    const rows = collection === "capacity" ? capacity : rates;
    rows[19].id = rows[0].id;
    await expect(collection === "capacity"
      ? saveCapacity(caseId, capacity, actor)
      : saveProposedRates(caseId, rates, actor)).rejects.toThrow(/UNIQUE constraint/);
    expect(await getCase(caseId)).toEqual(before);
  });

  it("duplicates 20 capabilities, 200 costs, 100 incomes and all plans without copying snapshots", async () => {
    const ids = (await capabilityRows(20)).map((row) => row.id);
    const costs = Array.from({ length: 200 }, (_, index) => ({
      id: `cost-${index}`, capabilityId: index % 2 ? ids[index % ids.length] : null,
      scope: index % 2 ? "CAPABILITY" as const : "PLATFORM" as const, category: "STAFFING" as const,
      label: `Synthetic cost ${index}`, amount: "100.00", justification: `Synthetic cost evidence ${index}.`,
    }));
    const income = Array.from({ length: 100 }, (_, index) => ({
      id: `income-${index}`, sourceName: `Synthetic support ${index}`,
      sourceType: index % 2 ? "UWA_SUPPORT" as const : "NON_UWA_SUPPORT" as const,
      amount: "20.00", justification: `Synthetic support evidence ${index}.`,
    }));
    await saveCostsAndIncome(caseId, costs, income, actor);
    await saveCapacity(caseId, capacityRows(ids), actor);
    const ready = await saveProposedRates(caseId, rateRows(ids), actor);
    await createSnapshot(caseId, ready, calculateCase(ready), actor);
    const before = await getCase(caseId);
    batches = [];
    queries = [];
    const copy = await duplicateCase(caseId, actor);
    expect(batches).toHaveLength(1);
    // Includes the source aggregate reads and every statement inside the batch;
    // excludes cold schema bootstrapping, which this adapter intentionally mocks.
    expect(queries).toHaveLength(42);
    expect(queries.length).toBeLessThanOrEqual(50);
    expect(copy.costingCase).toMatchObject({ status: "DRAFT", currentStep: 1, ownerId: actor.id, formulaVersion: "RIC_FORMULA_V1" });
    expect(copy.snapshots).toEqual([]);
    expect(copy.snapshotFreshness).toBe("NONE");
    expect(copy.capabilities).toHaveLength(20);
    const mapped = new Map(before.capabilities.map((row, index) => [row.id, copy.capabilities[index].id]));
    for (const collection of ["capabilities", "costs", "income", "capacity", "proposedRates"] as const) {
      const expected = before[collection].map((row) => {
        const fields = Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id"));
        return { ...fields, caseId: copy.costingCase.id, ...("capabilityId" in row ? { capabilityId: row.capabilityId ? mapped.get(row.capabilityId) : null } : {}) };
      });
      expect(copy[collection].map((row) => Object.fromEntries(Object.entries(row).filter(([key]) => key !== "id")))).toEqual(expect.arrayContaining(expected));
      expect(copy[collection]).toHaveLength(expected.length);
    }
    expect(copy.capabilities.every((row) => !ids.includes(row.id))).toBe(true);
    expect(copy.auditEvents.map((row) => row.action).sort()).toEqual(["CASE_CREATED", "CASE_DUPLICATED", "COSTS_SAVED", "INCOME_SAVED"]);
    expect(await getCase(copy.costingCase.id)).toEqual(copy);
    expect(await getCase(caseId)).toEqual(before);
    expect(queries.every((query) => query.params.length <= 100)).toBe(true);
  });

  it("does not leave a partial new case when duplication fails at its final audit", async () => {
    const before = await listCases();
    sqlite.exec(`CREATE TRIGGER fail_copy BEFORE INSERT ON audit_events
      WHEN NEW.action = 'CASE_DUPLICATED' BEGIN SELECT RAISE(ABORT, 'Synthetic copy failure'); END`);
    await expect(duplicateCase(caseId, actor)).rejects.toThrow();
    expect(await listCases()).toEqual(before);
  });

  it.each([false, true])("preserves explicit empty-save markers when duplicating (saved=%s)", async (saved) => {
    if (saved) await saveCostsAndIncome(caseId, [], [], actor);
    const copy = await duplicateCase(caseId, actor);
    expect(copy.costs).toEqual([]);
    expect(copy.income).toEqual([]);
    expect(copy.auditEvents.filter((row) => row.action === "COSTS_SAVED")).toHaveLength(saved ? 1 : 0);
    expect(copy.auditEvents.filter((row) => row.action === "INCOME_SAVED")).toHaveLength(saved ? 1 : 0);
    expect(await getCase(copy.costingCase.id)).toEqual(copy);
  });
});
