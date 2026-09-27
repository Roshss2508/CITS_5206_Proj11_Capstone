import { describe, expect, it } from "vitest";
import { parseSnapshotInput, resolveExportSnapshot } from "@/src/modules/exportSnapshot";
import type { CalculationSnapshot, CostingCase } from "@/src/modules/types";

function makeCase(overrides: Partial<CostingCase> = {}): CostingCase {
  return {
    id: "case-1",
    platformName: "Original Platform Name",
    pricingPeriod: "2026-2028",
    status: "DRAFT",
    formulaVersion: "RIC_FORMULA_V1",
    ownerId: "owner-1",
    currentStep: 5,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeSnapshot(id: string, createdAt: string, costingCase: CostingCase): CalculationSnapshot {
  return {
    id,
    caseId: "case-1",
    formulaVersion: "RIC_FORMULA_V1",
    inputJson: JSON.stringify({
      costingCase,
      capabilities: [],
      costs: [{ id: "cost-1", caseId: "case-1", capabilityId: null, category: "STAFFING", scope: "PLATFORM", label: "Staffing", amount: "1000", justification: `Evidence at snapshot ${id}` }],
      income: [],
      capacity: [],
      proposedRates: [],
    }),
    outputJson: "{}",
    createdBy: "actor-1",
    createdAt,
  };
}

describe("resolveExportSnapshot", () => {
  const older = makeSnapshot("snap-older", "2026-01-01T00:00:00.000Z", makeCase());
  const newest = makeSnapshot("snap-newest", "2026-02-01T00:00:00.000Z", makeCase());
  const snapshots = [newest, older]; // getCase() orders newest first

  it("returns the newest snapshot when no id is requested", () => {
    expect(resolveExportSnapshot(snapshots)).toBe(newest);
  });

  it("returns the matching snapshot when an id is requested", () => {
    expect(resolveExportSnapshot(snapshots, "snap-older")).toBe(older);
  });

  it("returns undefined when the requested id does not match any snapshot", () => {
    expect(resolveExportSnapshot(snapshots, "does-not-exist")).toBeUndefined();
  });

  it("returns undefined when there are no snapshots yet", () => {
    expect(resolveExportSnapshot([])).toBeUndefined();
  });
});

describe("parseSnapshotInput", () => {
  it("returns exactly the frozen input recorded on the snapshot, independent of any other case state", () => {
    const snapshot = makeSnapshot("snap-1", "2026-01-01T00:00:00.000Z", makeCase({ platformName: "Frozen Platform Name" }));

    const input = parseSnapshotInput(snapshot);

    expect(input.costingCase.platformName).toBe("Frozen Platform Name");
    expect(input.costs).toHaveLength(1);
    expect(input.costs[0].justification).toBe("Evidence at snapshot snap-1");
  });
});
