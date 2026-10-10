import { readFileSync } from "node:fs";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as schema from "@/db/schema";
import { createCase, getCase, saveCosts, saveCostsAndIncome, saveIncome, updateCase } from "@/src/modules/repository";
import type { Actor, CostLine, IncomeLine } from "@/src/modules/types";

const database = vi.hoisted(() => ({ getDb: vi.fn(), ensureDatabase: vi.fn() }));
vi.mock("@/db", () => database);

type Query = { sql: string; params: unknown[]; method: string };
const actor: Actor = { id: "batch-test-editor", name: "Synthetic editor", role: "EDITOR" };
const migration = readFileSync(new URL("../drizzle/0000_sloppy_titanium_man.sql", import.meta.url), "utf8");

describe("Step 2 repository with D1's 100-parameter limit", () => {
  let sqlite: DatabaseSync;
  let caseId: string;
  let capabilityId: string;
  let batches: Query[][];

  beforeEach(async () => {
    sqlite = new DatabaseSync(":memory:");
    sqlite.exec("PRAGMA foreign_keys = ON");
    sqlite.exec(migration);
    batches = [];

    // Execute the repository's real Drizzle SQL against SQLite, enforcing D1's
    // production limit even if the local D1 emulator allows more parameters.
    const execute = ({ sql, params, method }: Query) => {
      if (params.length > 100) throw new Error(`D1 parameter limit exceeded: ${params.length}`);
      const statement = sqlite.prepare(sql);
      if (method === "run") {
        statement.run(...params as SQLInputValue[]);
        return { rows: [] };
      }
      statement.setReturnArrays(true);
      return { rows: statement.all(...params as SQLInputValue[]) };
    };
    const db = drizzle(
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
    );
    database.getDb.mockReturnValue(db);
    const created = await createCase("Synthetic batching case", "2027-2029", actor);
    caseId = created.costingCase.id;
    capabilityId = created.capabilities[0].id;
  });

  afterEach(() => {
    sqlite.close();
    vi.clearAllMocks();
  });

  const costs = (count: number): Array<Omit<CostLine, "caseId">> => Array.from({ length: count }, (_, index) => ({
    id: `cost-${index}`, capabilityId, category: "STAFFING", scope: "CAPABILITY",
    label: `Synthetic cost ${index}`, amount: `${index + 1}.23`, justification: `Synthetic evidence ${index}.`,
  }));
  const income = (count: number): Array<Omit<IncomeLine, "caseId">> => Array.from({ length: count }, (_, index) => ({
    id: `income-${index}`, sourceName: `Synthetic support ${index}`,
    sourceType: index % 2 === 0 ? "UWA_SUPPORT" : "NON_UWA_SUPPORT",
    amount: `${index + 1}.45`, justification: `Synthetic support evidence ${index}.`,
  }));
  const byId = <T extends { id: string }>(rows: T[]) => [...rows].sort((a, b) => a.id.localeCompare(b.id));

  it.each([[0, 0], [1, 1], [12, 16], [13, 0], [0, 17], [13, 17], [200, 100]])(
    "saves %i costs and %i income rows completely in one transaction",
    async (costCount, incomeCount) => {
      const costRows = costs(costCount);
      const incomeRows = income(incomeCount);
      const saved = await saveCostsAndIncome(caseId, costRows, incomeRows, actor);

      expect(byId(saved.costs)).toEqual(byId(costRows.map((row) => ({ ...row, caseId }))));
      expect(byId(saved.income)).toEqual(byId(incomeRows.map((row) => ({ ...row, caseId }))));
      expect(saved.costingCase.currentStep).toBe(3);
      expect(saved.auditEvents.filter((event) => event.action === "COSTS_SAVED")).toHaveLength(1);
      expect(saved.auditEvents.filter((event) => event.action === "INCOME_SAVED")).toHaveLength(1);
      expect(batches).toHaveLength(1);
      expect(batches[0].every((query) => query.params.length <= 100)).toBe(true);
    },
  );

  it.each(["costs", "income"] as const)("rolls back every batch when a late %s insert fails", async (collection) => {
    await saveCostsAndIncome(caseId, costs(1), income(1), actor);
    await updateCase(caseId, { currentStep: 2 }, actor);
    const before = await getCase(caseId);
    const costRows = costs(200);
    const incomeRows = income(100);
    const rows = collection === "costs" ? costRows : incomeRows;
    // Repeat the first primary key in the final insert, after earlier inserts
    // have succeeded. No earlier chunk, timestamp or audit may survive.
    rows[rows.length - 1].id = rows[0].id;
    batches = [];

    await expect(saveCostsAndIncome(caseId, costRows, incomeRows, actor)).rejects.toThrow(/UNIQUE constraint/);
    expect(await getCase(caseId)).toEqual(before);
    expect(batches).toHaveLength(1);
    expect(batches[0].every((query) => query.params.length <= 100)).toBe(true);
  });

  it("keeps the separate cost and income save paths compatible at their maximum sizes", async () => {
    const costRows = costs(200);
    const incomeRows = income(100);
    await saveCosts(caseId, costRows, actor);
    const saved = await saveIncome(caseId, incomeRows, actor);
    expect(byId(saved.costs)).toEqual(byId(costRows.map((row) => ({ ...row, caseId }))));
    expect(byId(saved.income)).toEqual(byId(incomeRows.map((row) => ({ ...row, caseId }))));
    expect(batches).toHaveLength(2);
    expect(batches.flat().every((query) => query.params.length <= 100)).toBe(true);
  });

  it("preserves platform costs and generates unique ids when callers omit them", async () => {
    const costRows = costs(25).map((row) => ({ ...row, id: undefined, scope: "PLATFORM" as const, capabilityId: null }));
    const incomeRows = income(35).map((row) => ({ ...row, id: undefined }));
    const saved = await saveCostsAndIncome(caseId, costRows, incomeRows, actor);
    expect(saved.costs).toHaveLength(25);
    expect(saved.income).toHaveLength(35);
    expect(new Set([...saved.costs, ...saved.income].map((row) => row.id)).size).toBe(60);
    expect(saved.costs.every((row) => row.scope === "PLATFORM" && row.capabilityId === null)).toBe(true);
    expect(saved.costs.map((row) => row.amount).sort()).toEqual(costRows.map((row) => row.amount).sort());
    expect(saved.income.map((row) => row.amount).sort()).toEqual(incomeRows.map((row) => row.amount).sort());
    expect(batches).toHaveLength(1);
  });
});
