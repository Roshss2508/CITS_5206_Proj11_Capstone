import { describe, expect, it } from "vitest";
import { calculateCase } from "@/src/modules/calculation";
import { getSnapshotFreshness } from "@/src/modules/snapshotFreshness";
import type { CalculationSnapshot, CostingCaseAggregate } from "@/src/modules/types";

type Inputs = Omit<CostingCaseAggregate, "snapshots" | "snapshotFreshness" | "auditEvents" | "benchmarks">;

function inputs(): Inputs {
  return {
    costingCase: { id: "case-1", platformName: "Synthetic Platform", pricingPeriod: "2027-2029", status: "DRAFT", formulaVersion: "RIC_FORMULA_V1", ownerId: "demo-editor", currentStep: 4, createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" },
    capabilities: [
      { id: "cap-1", caseId: "case-1", name: "Microscope", billableUnit: "HOUR", active: true, displayOrder: 0 },
      { id: "cap-2", caseId: "case-1", name: "Sequencer", billableUnit: "SAMPLE", active: true, displayOrder: 1 },
    ],
    costs: [
      { id: "cost-1", caseId: "case-1", capabilityId: "cap-1", category: "MAINTENANCE", scope: "CAPABILITY", label: "Maintenance", amount: "100000", justification: "Direct annual cost." },
      { id: "cost-2", caseId: "case-1", capabilityId: null, category: "STAFFING", scope: "PLATFORM", label: "Staffing", amount: "50000", justification: "Shared annual cost." },
    ],
    income: [
      { id: "income-1", caseId: "case-1", sourceName: "UWA", sourceType: "UWA_SUPPORT", amount: "20000", justification: "Recurrent support." },
      { id: "income-2", caseId: "case-1", sourceName: "WA Government", sourceType: "NON_UWA_SUPPORT", amount: "30000", justification: "Recurrent support." },
    ],
    capacity: [
      { id: "capacity-1", caseId: "case-1", capabilityId: "cap-1", maximumCapacity: "1000", forecastUtilisationPct: "80", historicYear1: "700", historicYear2: null, historicYear3: null, justification: "Forecast." },
      { id: "capacity-2", caseId: "case-1", capabilityId: "cap-2", maximumCapacity: "500", forecastUtilisationPct: "60", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Forecast." },
    ],
    proposedRates: [
      { id: "rates-1", caseId: "case-1", capabilityId: "cap-1", uwaRate: null, apfrRate: "120", commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Scenario." },
      { id: "rates-2", caseId: "case-1", capabilityId: "cap-2", uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Scenario." },
    ],
  };
}

/** Builds a case whose newest snapshot was taken from `snapshotInputs`, while the live data is `current`. */
function caseWithSnapshot(current: Inputs, snapshotInputs: Inputs = inputs(), formulaVersion: "RIC_FORMULA_V1" = "RIC_FORMULA_V1"): Parameters<typeof getSnapshotFreshness>[0] {
  const output = calculateCase({ ...snapshotInputs, benchmarks: [], snapshots: [], snapshotFreshness: "NONE", auditEvents: [] });
  const snapshot: CalculationSnapshot = {
    id: "snapshot-1",
    caseId: "case-1",
    formulaVersion,
    inputJson: JSON.stringify(snapshotInputs),
    outputJson: JSON.stringify(output),
    createdBy: "demo-editor",
    createdAt: output.calculatedAt,
  };
  return { ...current, snapshots: [snapshot] };
}

function freshnessAfter(change: (draft: Inputs) => void) {
  const current = inputs();
  change(current);
  return getSnapshotFreshness(caseWithSnapshot(current));
}

describe("getSnapshotFreshness", () => {
  it("reports NONE when the case has no snapshot yet", () => {
    expect(getSnapshotFreshness({ ...inputs(), snapshots: [] })).toBe("NONE");
  });

  it("reports CURRENT when nothing has changed since the snapshot", () => {
    expect(getSnapshotFreshness(caseWithSnapshot(inputs()))).toBe("CURRENT");
  });

  describe("calculation-relevant changes make the snapshot stale", () => {
    it.each<[string, (draft: Inputs) => void]>([
      ["a cost amount", (d) => { d.costs[0].amount = "100001"; }],
      ["a cost moving to another capability", (d) => { d.costs[0].capabilityId = "cap-2"; }],
      ["a cost switching from capability to platform scope", (d) => { d.costs[0].scope = "PLATFORM"; d.costs[0].capabilityId = null; }],
      ["an added cost line", (d) => { d.costs.push({ ...d.costs[0], id: "cost-3", amount: "1" }); }],
      ["a removed cost line", (d) => { d.costs.pop(); }],
      ["an income amount", (d) => { d.income[0].amount = "25000"; }],
      ["an income source type", (d) => { d.income[0].sourceType = "NON_UWA_SUPPORT"; }],
      ["a removed income line", (d) => { d.income.pop(); }],
      ["maximum capacity", (d) => { d.capacity[0].maximumCapacity = "1200"; }],
      ["forecast utilisation", (d) => { d.capacity[1].forecastUtilisationPct = "65"; }],
      ["a proposed rate", (d) => { d.proposedRates[0].apfrRate = "125"; }],
      ["a proposed rate being cleared", (d) => { d.proposedRates[0].apfrRate = null; }],
      ["a proposed rate being set from empty", (d) => { d.proposedRates[1].uwaRate = "0"; }],
      ["the expected user-category mix", (d) => { d.proposedRates[0].uwaSharePct = "50"; d.proposedRates[0].commercialSharePct = "25"; }],
      ["a capability name", (d) => { d.capabilities[0].name = "Confocal microscope"; }],
      ["a capability billable unit", (d) => { d.capabilities[0].billableUnit = "DAY"; }],
      ["a capability being deactivated", (d) => { d.capabilities[1].active = false; }],
      ["a capability being removed", (d) => { d.capabilities.pop(); d.capacity.pop(); d.proposedRates.pop(); }],
      ["capability display order", (d) => { d.capabilities[0].displayOrder = 1; d.capabilities[1].displayOrder = 0; }],
    ])("%s", (_label, change) => {
      expect(freshnessAfter(change)).toBe("STALE");
    });
  });

  describe("changes that cannot affect the numbers keep the snapshot current", () => {
    it.each<[string, (draft: Inputs) => void]>([
      ["saving identical data again with new row ids", (d) => {
        d.costs.forEach((row, i) => { row.id = `new-cost-${i}`; });
        d.income.forEach((row, i) => { row.id = `new-income-${i}`; });
        d.capacity.forEach((row, i) => { row.id = `new-capacity-${i}`; });
        d.proposedRates.forEach((row, i) => { row.id = `new-rates-${i}`; });
      }],
      ["rows coming back from the database in a different order", (d) => {
        d.costs.reverse(); d.income.reverse(); d.capacity.reverse(); d.proposedRates.reverse(); d.capabilities.reverse();
      }],
      ["the same amount written with different formatting", (d) => { d.costs[0].amount = "100000.00"; d.income[0].amount = "2e4"; d.capacity[0].forecastUtilisationPct = "80.0"; }],
      ["an empty proposed rate saved as an empty string instead of null", (d) => { d.proposedRates[0].uwaRate = ""; }],
      ["cost, income, capacity and scenario justifications", (d) => {
        d.costs[0].justification = "Reworded evidence."; d.income[0].justification = "Reworded evidence.";
        d.capacity[0].justification = "Reworded evidence."; d.proposedRates[0].justification = "Reworded evidence.";
      }],
      ["a cost or income label", (d) => { d.costs[0].label = "Renamed"; d.income[0].sourceName = "Renamed"; }],
      ["historic usage figures", (d) => { d.capacity[0].historicYear1 = "900"; d.capacity[0].historicYear2 = "800"; }],
      ["workflow status, step and timestamps (for example after a restore)", (d) => {
        d.costingCase.status = "DRAFT"; d.costingCase.currentStep = 2; d.costingCase.updatedAt = "2026-09-24T00:00:00.000Z";
        d.costingCase.platformName = "Renamed platform";
      }],
    ])("%s", (_label, change) => {
      expect(freshnessAfter(change)).toBe("CURRENT");
    });
  });

  it("only compares against the newest snapshot, not older ones", () => {
    const original = inputs();
    const edited = inputs();
    edited.costs[0].amount = "150000";
    const oldSnapshot = caseWithSnapshot(original).snapshots[0];
    const newSnapshot = { ...caseWithSnapshot(edited, edited).snapshots[0], id: "snapshot-2" };
    expect(getSnapshotFreshness({ ...edited, snapshots: [newSnapshot, oldSnapshot] })).toBe("CURRENT");
    expect(getSnapshotFreshness({ ...edited, snapshots: [oldSnapshot] })).toBe("STALE");
  });

  it("treats a snapshot whose stored input cannot be read as stale", () => {
    const aggregate = caseWithSnapshot(inputs());
    aggregate.snapshots[0] = { ...aggregate.snapshots[0], inputJson: "not json" };
    expect(getSnapshotFreshness(aggregate)).toBe("STALE");
  });

  it("does not modify the stored snapshot", () => {
    const aggregate = caseWithSnapshot(inputs());
    const before = JSON.stringify(aggregate.snapshots);
    aggregate.costs[0].amount = "1";
    getSnapshotFreshness(aggregate);
    expect(JSON.stringify(aggregate.snapshots)).toBe(before);
  });
});
