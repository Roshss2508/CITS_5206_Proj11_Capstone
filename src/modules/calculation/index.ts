import Decimal from "decimal.js";
import type {
  CalculationResult,
  CapabilityRateResult,
  CostingCaseAggregate,
  DecimalString,
  ProposedRate,
} from "@/src/modules/types";

export const FORMULA_VERSION = "RIC_FORMULA_V1" as const;
export const EXTERNAL_MULTIPLIER = new Decimal("1.35");
export const GST_MULTIPLIER = new Decimal("1.10");

const money = (value: Decimal): DecimalString => value.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toFixed(2);
const quantity = (value: Decimal): DecimalString => value.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toFixed(6);
const decimal = (value: DecimalString | null | undefined) => new Decimal(value || "0");

function requireNonNegative(label: string, value: Decimal) {
  if (!value.isFinite() || value.isNegative()) throw new Error(`${label} must be a non-negative number.`);
}

function proposedOrCalculated(proposed: ProposedRate | undefined, field: keyof ProposedRate, calculated: Decimal) {
  const raw = proposed?.[field];
  return typeof raw === "string" && raw.trim() !== "" ? decimal(raw) : calculated;
}

export function calculateCase(aggregate: CostingCaseAggregate, now = new Date().toISOString()): CalculationResult {
  const capabilities = aggregate.capabilities.filter((item) => item.active).sort((a, b) => a.displayOrder - b.displayOrder);
  if (capabilities.length < 1 || capabilities.length > 20) throw new Error("A case must contain between 1 and 20 active capabilities.");

  for (const line of aggregate.costs) requireNonNegative(line.label || "Cost", decimal(line.amount));
  for (const line of aggregate.income) requireNonNegative(line.sourceName || "Income", decimal(line.amount));

  const warnings: string[] = [];
  const sharedCosts = aggregate.costs
    .filter((line) => line.scope === "PLATFORM")
    .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
  const sharedCostPerCapability = sharedCosts.div(capabilities.length);

  const uwaSupportTotal = aggregate.income
    .filter((line) => line.sourceType === "UWA_SUPPORT")
    .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
  const nonUwaSupportTotal = aggregate.income
    .filter((line) => line.sourceType === "NON_UWA_SUPPORT")
    .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
  const uwaSupportPerCapability = uwaSupportTotal.div(capabilities.length);
  const nonUwaSupportPerCapability = nonUwaSupportTotal.div(capabilities.length);

  const results: CapabilityRateResult[] = capabilities.map((capability) => {
    const capacity = aggregate.capacity.find((item) => item.capabilityId === capability.id);
    if (!capacity) throw new Error(`${capability.name}: capacity and utilisation are required.`);
    const maximumCapacity = decimal(capacity.maximumCapacity);
    const utilisationPct = decimal(capacity.forecastUtilisationPct);
    requireNonNegative(`${capability.name} maximum capacity`, maximumCapacity);
    requireNonNegative(`${capability.name} utilisation`, utilisationPct);
    if (utilisationPct.greaterThan(100)) throw new Error(`${capability.name}: utilisation cannot exceed 100%.`);
    const forecastUnits = maximumCapacity.times(utilisationPct.div(100));
    if (!forecastUnits.isFinite() || forecastUnits.lessThanOrEqualTo(0)) {
      throw new Error(`${capability.name}: forecast billable units must be greater than zero.`);
    }

    const directCosts = aggregate.costs
      .filter((line) => line.scope === "CAPABILITY" && line.capabilityId === capability.id)
      .reduce((sum, line) => sum.plus(decimal(line.amount)), new Decimal(0));
    const totalOperatingCost = directCosts.plus(sharedCostPerCapability);

    const uwaNumerator = totalOperatingCost.minus(uwaSupportPerCapability).minus(nonUwaSupportPerCapability);
    const apfrNumerator = totalOperatingCost.minus(nonUwaSupportPerCapability);
    if (uwaNumerator.isNegative()) warnings.push(`${capability.name}: operating support exceeds the UWA recovery target; the UWA rate was floored at zero.`);
    if (apfrNumerator.isNegative()) warnings.push(`${capability.name}: non-UWA support exceeds the APFR recovery target; the APFR rate was floored at zero.`);

    const uwaRate = Decimal.max(0, uwaNumerator).div(forecastUnits);
    const apfrRate = Decimal.max(0, apfrNumerator).div(forecastUnits).times(EXTERNAL_MULTIPLIER);
    const commercialRate = totalOperatingCost.div(forecastUnits).times(EXTERNAL_MULTIPLIER);

    const proposed = aggregate.proposedRates.find((item) => item.capabilityId === capability.id);
    const proposedUwa = proposedOrCalculated(proposed, "uwaRate", uwaRate);
    const proposedApfr = proposedOrCalculated(proposed, "apfrRate", apfrRate);
    const proposedCommercial = proposedOrCalculated(proposed, "commercialRate", commercialRate);
    [proposedUwa, proposedApfr, proposedCommercial].forEach((rate) => requireNonNegative(`${capability.name} proposed rate`, rate));

    const uwaShare = decimal(proposed?.uwaSharePct ?? "60");
    const apfrShare = decimal(proposed?.apfrSharePct ?? "25");
    const commercialShare = decimal(proposed?.commercialSharePct ?? "15");
    const totalShare = uwaShare.plus(apfrShare).plus(commercialShare);
    if (!totalShare.equals(100)) throw new Error(`${capability.name}: user category shares must total 100%.`);

    const uwaRevenue = forecastUnits.times(uwaShare.div(100)).times(proposedUwa);
    const apfrRevenue = forecastUnits.times(apfrShare.div(100)).times(proposedApfr);
    const commercialRevenue = forecastUnits.times(commercialShare.div(100)).times(proposedCommercial);
    const grossRevenue = uwaRevenue.plus(apfrRevenue).plus(commercialRevenue);
    const externalRevenue = apfrRevenue.plus(commercialRevenue);
    const universityOverhead = externalRevenue.times(EXTERNAL_MULTIPLIER.minus(1).div(EXTERNAL_MULTIPLIER));
    const netPlatformRecovery = grossRevenue.minus(universityOverhead);
    const operatingBalance = netPlatformRecovery.plus(uwaSupportPerCapability).plus(nonUwaSupportPerCapability).minus(totalOperatingCost);

    return {
      capabilityId: capability.id,
      capabilityName: capability.name,
      billableUnit: capability.billableUnit,
      forecastUnits: quantity(forecastUnits),
      totalOperatingCost: money(totalOperatingCost),
      allocatedUwaSupport: money(uwaSupportPerCapability),
      allocatedNonUwaSupport: money(nonUwaSupportPerCapability),
      sustainableRates: { UWA: money(uwaRate), APFR: money(apfrRate), COMMERCIAL: money(commercialRate) },
      proposedRates: { UWA: money(proposedUwa), APFR: money(proposedApfr), COMMERCIAL: money(proposedCommercial) },
      overheadComponents: {
        APFR: money(proposedApfr.minus(proposedApfr.div(EXTERNAL_MULTIPLIER))),
        COMMERCIAL: money(proposedCommercial.minus(proposedCommercial.div(EXTERNAL_MULTIPLIER))),
      },
      grossRevenue: money(grossRevenue),
      universityOverhead: money(universityOverhead),
      netPlatformRecovery: money(netPlatformRecovery),
      operatingBalance: money(operatingBalance),
    };
  });

  const sum = (field: "grossRevenue" | "universityOverhead" | "netPlatformRecovery" | "operatingBalance") =>
    results.reduce((total, result) => total.plus(result[field]), new Decimal(0));

  return {
    formulaVersion: FORMULA_VERSION,
    calculatedAt: now,
    capabilities: results,
    grossRevenue: money(sum("grossRevenue")),
    universityOverhead: money(sum("universityOverhead")),
    netPlatformRecovery: money(sum("netPlatformRecovery")),
    operatingBalance: money(sum("operatingBalance")),
    warnings,
  };
}
