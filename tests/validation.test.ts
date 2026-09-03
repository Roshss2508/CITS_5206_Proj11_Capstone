import { describe, expect, it } from "vitest";
import {
  capabilitiesSchema,
  capacitySchema,
  costsSchema,
  incomeSchema,
  proposedRatesSchema,
} from "@/src/modules/validation";

function capacityRow(overrides: Partial<{ maximumCapacity: string; forecastUtilisationPct: string }> = {}) {
  return {
    capabilityId: "cap-1",
    maximumCapacity: "1000",
    forecastUtilisationPct: "100",
    historicYear1: null,
    historicYear2: null,
    historicYear3: null,
    justification: "Reference case.",
    ...overrides,
  };
}

function rateRow(overrides: Partial<{ uwaSharePct: string; apfrSharePct: string; commercialSharePct: string }> = {}) {
  return {
    capabilityId: "cap-1",
    uwaRate: null,
    apfrRate: null,
    commercialRate: null,
    uwaSharePct: "60",
    apfrSharePct: "25",
    commercialSharePct: "15",
    justification: "Use calculated rates.",
    ...overrides,
  };
}

describe("capabilitiesSchema", () => {
  it("accepts a valid capability", () => {
    const result = capabilitiesSchema.safeParse({ capabilities: [{ name: "Microscope", billableUnit: "HOUR", active: true, displayOrder: 0 }] });
    expect(result.success).toBe(true);
  });

  it("rejects an empty capability list", () => {
    const result = capabilitiesSchema.safeParse({ capabilities: [] });
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognised billable unit", () => {
    const result = capabilitiesSchema.safeParse({ capabilities: [{ name: "Microscope", billableUnit: "WEEK", active: true, displayOrder: 0 }] });
    expect(result.success).toBe(false);
  });

  it("rejects a capability name that is too short", () => {
    const result = capabilitiesSchema.safeParse({ capabilities: [{ name: "A", billableUnit: "HOUR", active: true, displayOrder: 0 }] });
    expect(result.success).toBe(false);
  });
});

describe("costsSchema and incomeSchema", () => {
  it("rejects a negative cost amount", () => {
    const result = costsSchema.safeParse({ costs: [{ capabilityId: null, category: "OTHER", scope: "PLATFORM", label: "Staffing", amount: "-100", justification: "Explain the evidence." }] });
    expect(result.success).toBe(false);
  });

  it("rejects a non-numeric cost amount", () => {
    const result = costsSchema.safeParse({ costs: [{ capabilityId: null, category: "OTHER", scope: "PLATFORM", label: "Staffing", amount: "abc", justification: "Explain the evidence." }] });
    expect(result.success).toBe(false);
  });

  it("rejects a cost with more than two decimal places", () => {
    const result = costsSchema.safeParse({ costs: [{ capabilityId: null, category: "OTHER", scope: "PLATFORM", label: "Staffing", amount: "100.999", justification: "Explain the evidence." }] });
    expect(result.success).toBe(false);
  });

  it("rejects a cost line missing its justification", () => {
    const result = costsSchema.safeParse({ costs: [{ capabilityId: null, category: "OTHER", scope: "PLATFORM", label: "Staffing", amount: "100", justification: "" }] });
    expect(result.success).toBe(false);
  });

  it("rejects a negative income amount", () => {
    const result = incomeSchema.safeParse({ income: [{ sourceName: "UWA", sourceType: "UWA_SUPPORT", amount: "-1", justification: "Explain why this recurs." }] });
    expect(result.success).toBe(false);
  });
});

describe("capacitySchema", () => {
  it("accepts a valid capacity plan", () => {
    const result = capacitySchema.safeParse({ capacity: [capacityRow()] });
    expect(result.success).toBe(true);
  });

  it("rejects utilisation above 100 percent", () => {
    const result = capacitySchema.safeParse({ capacity: [capacityRow({ forecastUtilisationPct: "150" })] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/cannot exceed 100%/i);
  });

  it("rejects negative maximum capacity", () => {
    const result = capacitySchema.safeParse({ capacity: [capacityRow({ maximumCapacity: "-5" })] });
    expect(result.success).toBe(false);
  });

  it("rejects zero maximum capacity because forecast units would be zero", () => {
    const result = capacitySchema.safeParse({ capacity: [capacityRow({ maximumCapacity: "0" })] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/greater than zero/i);
  });

  it("rejects zero forecast utilisation because forecast units would be zero", () => {
    const result = capacitySchema.safeParse({ capacity: [capacityRow({ forecastUtilisationPct: "0" })] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/greater than zero/i);
  });
});

describe("proposedRatesSchema", () => {
  it("accepts user category shares that total 100 percent", () => {
    const result = proposedRatesSchema.safeParse({ proposedRates: [rateRow()] });
    expect(result.success).toBe(true);
  });

  it("rejects user category shares that do not total 100 percent", () => {
    const result = proposedRatesSchema.safeParse({ proposedRates: [rateRow({ uwaSharePct: "70" })] });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.message).toMatch(/total exactly 100%/i);
  });

  it("rejects fractional shares that sum to 100 only after floating-point rounding error", () => {
    const result = proposedRatesSchema.safeParse({ proposedRates: [rateRow({ uwaSharePct: "33.33", apfrSharePct: "33.33", commercialSharePct: "33.33" })] });
    expect(result.success).toBe(false);
  });

  it("accepts a blank proposed rate to fall back to the calculated minimum", () => {
    const result = proposedRatesSchema.safeParse({ proposedRates: [{ ...rateRow(), uwaRate: "" }] });
    expect(result.success).toBe(true);
  });

  it("rejects a negative proposed rate", () => {
    const result = proposedRatesSchema.safeParse({ proposedRates: [{ ...rateRow(), uwaRate: "-10" }] });
    expect(result.success).toBe(false);
  });
});
