import { describe, expect, it } from "vitest";
import { persistenceNumber, samePersistedRows } from "@/src/modules/persistenceComparison";

describe("persistence collection comparison", () => {
  const fields = (row: { label: string; amount: string }) => [row.label, persistenceNumber(row.amount)];
  const rows = [{ id: "a", label: "Identical evidence", amount: "100" }, { id: "b", label: "Identical evidence", amount: "100" }];

  it("retains duplicate multiplicity even when all IDs are omitted", () => {
    expect(samePersistedRows(rows, rows.map((row) => ({ ...row, id: undefined })), fields)).toBe(true);
    expect(samePersistedRows(rows, [rows[0]], fields)).toBe(false);
    expect(samePersistedRows(rows, [rows[0], rows[0]], fields)).toBe(false);
    expect(samePersistedRows(rows, [{ ...rows[0], id: undefined }, { ...rows[0], id: undefined, label: "Different" }], fields)).toBe(false);
  });

  it("reserves explicit identities before matching omitted IDs by content", () => {
    expect(samePersistedRows(rows, [{ ...rows[0], id: undefined }, rows[0]], fields)).toBe(true);
    expect(samePersistedRows(rows, [{ ...rows[0], id: "unknown" }, rows[1]], fields)).toBe(false);
  });

  it("does not allow a supplied ID to match a different row with the same content", () => {
    const existing = [{ id: "a", label: "First", amount: "100" }, { id: "b", label: "Second", amount: "100" }];
    expect(samePersistedRows(existing, [{ ...existing[0], id: "b" }, { ...existing[1], id: "a" }], fields)).toBe(false);
  });

  it("ignores transport ordering and number formatting but not evidence changes", () => {
    expect(samePersistedRows(rows, [...rows].reverse().map((row) => ({ ...row, amount: "0100.00" })), fields)).toBe(true);
    expect(samePersistedRows(rows, rows.map((row) => ({ ...row, label: "Changed evidence" })), fields)).toBe(false);
  });

  it("does not round values, coerce absent values to zero, or use floating-point numbers", () => {
    expect(persistenceNumber("9007199254740993.01")).toBe("9007199254740993.01");
    expect(persistenceNumber("0.000001")).toBe("0.000001");
    expect(persistenceNumber("0")).toBe("0");
    expect(persistenceNumber("")).toBeNull();
    expect(persistenceNumber(null)).toBeNull();
    expect(persistenceNumber(undefined)).toBeNull();
  });
});
