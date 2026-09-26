import Decimal from "decimal.js";
import type { CalculationSnapshot, CostingCaseAggregate, SnapshotFreshness } from "@/src/modules/types";

export const STALE_SNAPSHOT_MESSAGE =
  "The latest calculation is out of date because case inputs changed after it was calculated. Return to Step 4 and recalculate before submitting or approving the case.";

/** The parts of a case (or of a stored snapshot's input) that the calculation engine reads. */
type CalculationInputSource = Pick<CostingCaseAggregate, "capabilities" | "costs" | "income" | "capacity" | "proposedRates">;

// Numeric strings are compared by value so "100" and "100.00" do not count as a change.
// Empty and null are the same "not provided" value, matching how proposed rates are stored.
function normaliseNumber(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") return null;
  try {
    return new Decimal(value).toFixed();
  } catch {
    return value.trim();
  }
}

/**
 * Reduces case data to the fields that change a calculated result, in a stable order.
 * Row ids, labels, justifications, historic usage, workflow status and timestamps are
 * deliberately excluded: they are evidence or bookkeeping and never affect the numbers.
 */
export function calculationFingerprint(source: CalculationInputSource): string {
  const sortedRows = (rows: unknown[]) => rows.map((row) => JSON.stringify(row)).sort();
  return JSON.stringify({
    capabilities: [...source.capabilities]
      .sort((a, b) => a.displayOrder - b.displayOrder || a.id.localeCompare(b.id))
      .map((item) => [item.id, item.name, item.billableUnit, item.active, item.displayOrder]),
    costs: sortedRows(source.costs.map((item) => [item.scope, item.capabilityId ?? null, normaliseNumber(item.amount)])),
    income: sortedRows(source.income.map((item) => [item.sourceType, normaliseNumber(item.amount)])),
    capacity: sortedRows(source.capacity.map((item) => [item.capabilityId, normaliseNumber(item.maximumCapacity), normaliseNumber(item.forecastUtilisationPct)])),
    proposedRates: sortedRows(source.proposedRates.map((item) => [
      item.capabilityId,
      normaliseNumber(item.uwaRate),
      normaliseNumber(item.apfrRate),
      normaliseNumber(item.commercialRate),
      normaliseNumber(item.uwaSharePct),
      normaliseNumber(item.apfrSharePct),
      normaliseNumber(item.commercialSharePct),
    ])),
  });
}

/**
 * Compares the case as it is now with the inputs stored in its newest snapshot.
 * Snapshots are append-only, so only the newest one decides whether a case may be submitted.
 * A snapshot whose stored input cannot be read is treated as stale rather than trusted.
 */
export function getSnapshotFreshness(
  aggregate: CalculationInputSource & Pick<CostingCaseAggregate, "costingCase"> & { snapshots: CalculationSnapshot[] },
): SnapshotFreshness {
  const latest = aggregate.snapshots[0];
  if (!latest) return "NONE";
  if (latest.formulaVersion !== aggregate.costingCase.formulaVersion) return "STALE";
  try {
    const stored = JSON.parse(latest.inputJson) as CalculationInputSource;
    return calculationFingerprint(stored) === calculationFingerprint(aggregate) ? "CURRENT" : "STALE";
  } catch {
    return "STALE";
  }
}
