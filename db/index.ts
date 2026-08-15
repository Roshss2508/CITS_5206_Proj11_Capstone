import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS actors (id TEXT PRIMARY KEY NOT NULL, name TEXT NOT NULL, role TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS costing_cases (id TEXT PRIMARY KEY NOT NULL, platform_name TEXT NOT NULL, pricing_period TEXT NOT NULL, status TEXT NOT NULL, formula_version TEXT NOT NULL, owner_id TEXT NOT NULL REFERENCES actors(id), current_step INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_costing_cases_status_updated ON costing_cases(status, updated_at)`,
  `CREATE TABLE IF NOT EXISTS capabilities (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, name TEXT NOT NULL, billable_unit TEXT NOT NULL, active INTEGER NOT NULL, display_order INTEGER NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_capabilities_case_order ON capabilities(case_id, display_order)`,
  `CREATE TABLE IF NOT EXISTS cost_lines (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, capability_id TEXT REFERENCES capabilities(id) ON DELETE CASCADE, category TEXT NOT NULL, scope TEXT NOT NULL, label TEXT NOT NULL, amount TEXT NOT NULL, justification TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_cost_lines_case_scope ON cost_lines(case_id, scope)`,
  `CREATE TABLE IF NOT EXISTS income_lines (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, source_name TEXT NOT NULL, source_type TEXT NOT NULL, amount TEXT NOT NULL, justification TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_income_lines_case_type ON income_lines(case_id, source_type)`,
  `CREATE TABLE IF NOT EXISTS capacity_plans (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE, maximum_capacity TEXT NOT NULL, forecast_utilisation_pct TEXT NOT NULL, historic_year_1 TEXT, historic_year_2 TEXT, historic_year_3 TEXT, justification TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uidx_capacity_plans_capability ON capacity_plans(capability_id)`,
  `CREATE TABLE IF NOT EXISTS proposed_rates (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, capability_id TEXT NOT NULL REFERENCES capabilities(id) ON DELETE CASCADE, uwa_rate TEXT, apfr_rate TEXT, commercial_rate TEXT, uwa_share_pct TEXT NOT NULL, apfr_share_pct TEXT NOT NULL, commercial_share_pct TEXT NOT NULL, justification TEXT NOT NULL)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS uidx_proposed_rates_capability ON proposed_rates(capability_id)`,
  `CREATE TABLE IF NOT EXISTS benchmarks (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, capability_id TEXT REFERENCES capabilities(id) ON DELETE SET NULL, provider TEXT NOT NULL, rate TEXT NOT NULL, unit TEXT NOT NULL, source TEXT NOT NULL, notes TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_benchmarks_case ON benchmarks(case_id)`,
  `CREATE TABLE IF NOT EXISTS calculation_snapshots (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, formula_version TEXT NOT NULL, input_json TEXT NOT NULL, output_json TEXT NOT NULL, created_by TEXT NOT NULL REFERENCES actors(id), created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_snapshots_case_created ON calculation_snapshots(case_id, created_at)`,
  `CREATE TABLE IF NOT EXISTS audit_events (id TEXT PRIMARY KEY NOT NULL, case_id TEXT NOT NULL REFERENCES costing_cases(id) ON DELETE CASCADE, actor_id TEXT NOT NULL REFERENCES actors(id), action TEXT NOT NULL, from_status TEXT, to_status TEXT, details TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_audit_events_case_created ON audit_events(case_id, created_at)`,
  `INSERT OR IGNORE INTO actors (id, name, role) VALUES ('demo-editor', 'Alex Morgan', 'EDITOR')`,
  `INSERT OR IGNORE INTO actors (id, name, role) VALUES ('demo-reviewer', 'Erika Slavin', 'REVIEWER')`,
] as const;

let initialised = false;

export function getD1() {
  const runtimeEnv = env as unknown as { DB?: D1Database };
  if (!runtimeEnv.DB) throw new Error("Cloudflare D1 binding `DB` is unavailable.");
  return runtimeEnv.DB;
}

export function getDb() {
  return drizzle(getD1(), { schema });
}

export async function ensureDatabase() {
  if (initialised) return;
  const binding = getD1();
  await binding.batch(SCHEMA_STATEMENTS.map((statement) => binding.prepare(statement)));
  initialised = true;
}
