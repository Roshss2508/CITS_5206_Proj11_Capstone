import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const actors = sqliteTable("actors", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["EDITOR", "REVIEWER"] }).notNull(),
});

export const costingCases = sqliteTable("costing_cases", {
  id: text("id").primaryKey(),
  platformName: text("platform_name").notNull(),
  pricingPeriod: text("pricing_period").notNull(),
  status: text("status", { enum: ["DRAFT", "READY_FOR_REVIEW", "APPROVED", "ARCHIVED"] }).notNull(),
  formulaVersion: text("formula_version").notNull(),
  ownerId: text("owner_id").notNull().references(() => actors.id),
  currentStep: integer("current_step").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (table) => [index("idx_costing_cases_status_updated").on(table.status, table.updatedAt)]);

export const capabilities = sqliteTable("capabilities", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  billableUnit: text("billable_unit", { enum: ["HOUR", "DAY", "SAMPLE"] }).notNull(),
  active: integer("active", { mode: "boolean" }).notNull(),
  displayOrder: integer("display_order").notNull(),
}, (table) => [index("idx_capabilities_case_order").on(table.caseId, table.displayOrder)]);

export const costLines = sqliteTable("cost_lines", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").references(() => capabilities.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  scope: text("scope", { enum: ["CAPABILITY", "PLATFORM"] }).notNull(),
  label: text("label").notNull(),
  amount: text("amount").notNull(),
  justification: text("justification").notNull(),
}, (table) => [index("idx_cost_lines_case_scope").on(table.caseId, table.scope)]);

export const incomeLines = sqliteTable("income_lines", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  sourceName: text("source_name").notNull(),
  sourceType: text("source_type", { enum: ["UWA_SUPPORT", "NON_UWA_SUPPORT"] }).notNull(),
  amount: text("amount").notNull(),
  justification: text("justification").notNull(),
}, (table) => [index("idx_income_lines_case_type").on(table.caseId, table.sourceType)]);

export const capacityPlans = sqliteTable("capacity_plans", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").notNull().references(() => capabilities.id, { onDelete: "cascade" }),
  maximumCapacity: text("maximum_capacity").notNull(),
  forecastUtilisationPct: text("forecast_utilisation_pct").notNull(),
  historicYear1: text("historic_year_1"),
  historicYear2: text("historic_year_2"),
  historicYear3: text("historic_year_3"),
  justification: text("justification").notNull(),
}, (table) => [uniqueIndex("uidx_capacity_plans_capability").on(table.capabilityId)]);

export const proposedRates = sqliteTable("proposed_rates", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").notNull().references(() => capabilities.id, { onDelete: "cascade" }),
  uwaRate: text("uwa_rate"),
  apfrRate: text("apfr_rate"),
  commercialRate: text("commercial_rate"),
  uwaSharePct: text("uwa_share_pct").notNull(),
  apfrSharePct: text("apfr_share_pct").notNull(),
  commercialSharePct: text("commercial_share_pct").notNull(),
  justification: text("justification").notNull(),
}, (table) => [uniqueIndex("uidx_proposed_rates_capability").on(table.capabilityId)]);

export const benchmarks = sqliteTable("benchmarks", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  capabilityId: text("capability_id").references(() => capabilities.id, { onDelete: "set null" }),
  provider: text("provider").notNull(),
  rate: text("rate").notNull(),
  unit: text("unit").notNull(),
  source: text("source").notNull(),
  notes: text("notes").notNull(),
}, (table) => [index("idx_benchmarks_case").on(table.caseId)]);

export const calculationSnapshots = sqliteTable("calculation_snapshots", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  formulaVersion: text("formula_version").notNull(),
  inputJson: text("input_json").notNull(),
  outputJson: text("output_json").notNull(),
  createdBy: text("created_by").notNull().references(() => actors.id),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_snapshots_case_created").on(table.caseId, table.createdAt)]);

export const auditEvents = sqliteTable("audit_events", {
  id: text("id").primaryKey(),
  caseId: text("case_id").notNull().references(() => costingCases.id, { onDelete: "cascade" }),
  actorId: text("actor_id").notNull().references(() => actors.id),
  action: text("action").notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status"),
  details: text("details").notNull(),
  createdAt: text("created_at").notNull(),
}, (table) => [index("idx_audit_events_case_created").on(table.caseId, table.createdAt)]);
