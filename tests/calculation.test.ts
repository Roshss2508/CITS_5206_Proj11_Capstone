import { describe, expect, it } from "vitest";
import { calculateCase } from "@/src/modules/calculation";
import type { CostingCaseAggregate } from "@/src/modules/types";

function fixture(): CostingCaseAggregate {
  return {
    costingCase: { id: "case-1", platformName: "Synthetic Platform", pricingPeriod: "2027-2029", status: "DRAFT", formulaVersion: "RIC_FORMULA_V1", ownerId: "demo-editor", currentStep: 4, createdAt: "2026-08-15T00:00:00.000Z", updatedAt: "2026-08-15T00:00:00.000Z" },
    capabilities: [{ id: "cap-1", caseId: "case-1", name: "Microscope", billableUnit: "HOUR", active: true, displayOrder: 0 }],
    costs: [
      { id: "cost-1", caseId: "case-1", capabilityId: "cap-1", category: "MAINTENANCE", scope: "CAPABILITY", label: "Maintenance", amount: "100000", justification: "Synthetic direct annual cost." },
      { id: "cost-2", caseId: "case-1", capabilityId: null, category: "STAFFING", scope: "PLATFORM", label: "Staffing", amount: "50000", justification: "Synthetic shared annual cost." },
    ],
    income: [
      { id: "income-1", caseId: "case-1", sourceName: "UWA", sourceType: "UWA_SUPPORT", amount: "20000", justification: "Reference case." },
      { id: "income-2", caseId: "case-1", sourceName: "WA Government", sourceType: "NON_UWA_SUPPORT", amount: "30000", justification: "Reference case." },
    ],
    capacity: [{ id: "capacity-1", caseId: "case-1", capabilityId: "cap-1", maximumCapacity: "1000", forecastUtilisationPct: "100", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Reference case." }],
    proposedRates: [{ id: "rates-1", caseId: "case-1", capabilityId: "cap-1", uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Use calculated rates." }],
    benchmarks: [], snapshots: [], auditEvents: [],
  };
}

describe("RIC_FORMULA_V1", () => {
  it("reproduces the client golden calculation exactly", () => {
    const result = calculateCase(fixture(), "2026-08-15T00:00:00.000Z");
    expect(result.capabilities[0].sustainableRates).toEqual({ UWA: "100.00", APFR: "162.00", COMMERCIAL: "202.50" });
    expect(result.formulaVersion).toBe("RIC_FORMULA_V1");
  });

  it("rejects zero forecast billable units", () => {
    const input = fixture();
    input.capacity[0].forecastUtilisationPct = "0";
    expect(() => calculateCase(input)).toThrow(/greater than zero/i);
  });

  it("does not use UWA support to reduce the commercial rate", () => {
    const baseline = calculateCase(fixture()).capabilities[0].sustainableRates.COMMERCIAL;
    const input = fixture();
    input.income[0].amount = "90000";
    expect(calculateCase(input).capabilities[0].sustainableRates.COMMERCIAL).toBe(baseline);
  });

  it("allocates platform costs once across multiple capabilities", () => {
    const input = fixture();
    input.capabilities.push({ id: "cap-2", caseId: "case-1", name: "Spectrometer", billableUnit: "HOUR", active: true, displayOrder: 1 });
    input.capacity.push({ ...input.capacity[0], id: "capacity-2", capabilityId: "cap-2" });
    input.proposedRates.push({ ...input.proposedRates[0], id: "rates-2", capabilityId: "cap-2" });
    const result = calculateCase(input);
    expect(result.capabilities[0].totalOperatingCost).toBe("125000.00");
    expect(result.capabilities[1].totalOperatingCost).toBe("25000.00");
  });

  it("rejects a user mix that does not total 100 percent", () => {
    const input = fixture();
    input.proposedRates[0].uwaSharePct = "70";
    expect(() => calculateCase(input)).toThrow(/total 100%/i);
  });
});
