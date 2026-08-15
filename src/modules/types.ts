export type DecimalString = string;
export type UserCategory = "UWA" | "APFR" | "COMMERCIAL";
export type BillableUnit = "HOUR" | "DAY" | "SAMPLE";
export type CaseStatus = "DRAFT" | "READY_FOR_REVIEW" | "APPROVED" | "ARCHIVED";
export type CostScope = "CAPABILITY" | "PLATFORM";
export type IncomeSourceType = "UWA_SUPPORT" | "NON_UWA_SUPPORT";
export type ActorRole = "EDITOR" | "REVIEWER";

export const COST_CATEGORIES = [
  "STAFFING",
  "MAINTENANCE",
  "MATERIALS",
  "SOFTWARE",
  "UTILITIES",
  "COMPLIANCE",
  "REPLACEMENT_RESERVE",
  "OTHER",
] as const;

export type CostCategory = (typeof COST_CATEGORIES)[number];

export interface Actor {
  id: string;
  name: string;
  role: ActorRole;
}

export interface CostingCase {
  id: string;
  platformName: string;
  pricingPeriod: string;
  status: CaseStatus;
  formulaVersion: "RIC_FORMULA_V1";
  ownerId: string;
  currentStep: number;
  createdAt: string;
  updatedAt: string;
}

export interface Capability {
  id: string;
  caseId: string;
  name: string;
  billableUnit: BillableUnit;
  active: boolean;
  displayOrder: number;
}

export interface CostLine {
  id: string;
  caseId: string;
  capabilityId: string | null;
  category: CostCategory;
  scope: CostScope;
  label: string;
  amount: DecimalString;
  justification: string;
}

export interface IncomeLine {
  id: string;
  caseId: string;
  sourceName: string;
  sourceType: IncomeSourceType;
  amount: DecimalString;
  justification: string;
}

export interface CapacityPlan {
  id: string;
  caseId: string;
  capabilityId: string;
  maximumCapacity: DecimalString;
  forecastUtilisationPct: DecimalString;
  historicYear1: DecimalString | null;
  historicYear2: DecimalString | null;
  historicYear3: DecimalString | null;
  justification: string;
}

export interface ProposedRate {
  id: string;
  caseId: string;
  capabilityId: string;
  uwaRate: DecimalString | null;
  apfrRate: DecimalString | null;
  commercialRate: DecimalString | null;
  uwaSharePct: DecimalString;
  apfrSharePct: DecimalString;
  commercialSharePct: DecimalString;
  justification: string;
}

export interface Benchmark {
  id: string;
  caseId: string;
  capabilityId: string | null;
  provider: string;
  rate: DecimalString;
  unit: string;
  source: string;
  notes: string;
}

export interface CalculationSnapshot {
  id: string;
  caseId: string;
  formulaVersion: "RIC_FORMULA_V1";
  inputJson: string;
  outputJson: string;
  createdBy: string;
  createdAt: string;
}

export interface AuditEvent {
  id: string;
  caseId: string;
  actorId: string;
  action: string;
  fromStatus: CaseStatus | null;
  toStatus: CaseStatus | null;
  details: string;
  createdAt: string;
}

export interface CostingCaseAggregate {
  costingCase: CostingCase;
  capabilities: Capability[];
  costs: CostLine[];
  income: IncomeLine[];
  capacity: CapacityPlan[];
  proposedRates: ProposedRate[];
  benchmarks: Benchmark[];
  snapshots: CalculationSnapshot[];
  auditEvents: AuditEvent[];
}

export interface CapabilityRateResult {
  capabilityId: string;
  capabilityName: string;
  billableUnit: BillableUnit;
  forecastUnits: DecimalString;
  totalOperatingCost: DecimalString;
  allocatedUwaSupport: DecimalString;
  allocatedNonUwaSupport: DecimalString;
  sustainableRates: Record<UserCategory, DecimalString>;
  proposedRates: Record<UserCategory, DecimalString>;
  overheadComponents: Pick<Record<UserCategory, DecimalString>, "APFR" | "COMMERCIAL">;
  grossRevenue: DecimalString;
  universityOverhead: DecimalString;
  netPlatformRecovery: DecimalString;
  operatingBalance: DecimalString;
}

export interface CalculationResult {
  formulaVersion: "RIC_FORMULA_V1";
  calculatedAt: string;
  capabilities: CapabilityRateResult[];
  grossRevenue: DecimalString;
  universityOverhead: DecimalString;
  netPlatformRecovery: DecimalString;
  operatingBalance: DecimalString;
  warnings: string[];
}
