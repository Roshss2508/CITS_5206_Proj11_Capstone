import { ApiError, type ApiFieldIssue } from "@/src/client/api";

const FIELD_LABELS: Record<string, string> = {
  name: "Capability name",
  billableUnit: "Billable unit",
  label: "Cost label",
  category: "Cost category",
  scope: "Cost scope",
  amount: "Amount",
  sourceName: "Income source",
  sourceType: "Income classification",
  maximumCapacity: "Maximum capacity",
  forecastUtilisationPct: "Forecast utilisation",
  historicYear1: "Historic year 1",
  historicYear2: "Historic year 2",
  historicYear3: "Historic year 3",
  uwaRate: "UWA proposed rate",
  apfrRate: "APFR proposed rate",
  commercialRate: "Commercial proposed rate",
  uwaSharePct: "UWA user share",
  apfrSharePct: "APFR user share",
  commercialSharePct: "Commercial user share",
  justification: "Justification",
  platformName: "Platform name",
  pricingPeriod: "Pricing period",
};

function describeIssue(issue: ApiFieldIssue): string {
  const segments = issue.path.split(".").filter(Boolean);
  const rowIndex = segments.find((segment) => /^\d+$/.test(segment));
  const fieldKey = [...segments].reverse().find((segment) => !/^\d+$/.test(segment));
  const label = fieldKey ? FIELD_LABELS[fieldKey] || fieldKey : "";
  const prefix = rowIndex !== undefined ? `Row ${Number(rowIndex) + 1}${label ? ` – ${label}` : ""}` : label;
  return prefix ? `${prefix}: ${issue.message}` : issue.message;
}

export function describeApiIssues(issues: ApiFieldIssue[]): string {
  return issues.map(describeIssue).join(" ");
}

export function describeError(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && caught.issues.length > 0) return describeApiIssues(caught.issues);
  if (caught instanceof Error) return caught.message;
  return fallback;
}
