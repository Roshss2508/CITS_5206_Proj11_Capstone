import { and, desc, eq, inArray } from "drizzle-orm";
import { ensureDatabase, getDb } from "@/db";
import {
  actors,
  auditEvents,
  benchmarks,
  calculationSnapshots,
  capabilities,
  capacityPlans,
  costingCases,
  costLines,
  incomeLines,
  proposedRates,
} from "@/db/schema";
import type {
  Actor,
  AuditEvent,
  Benchmark,
  CalculationResult,
  CalculationSnapshot,
  Capability,
  CapacityPlan,
  CaseStatus,
  CostLine,
  CostingCase,
  CostingCaseAggregate,
  IncomeLine,
  ProposedRate,
} from "@/src/modules/types";

const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();

async function assertEditable(caseId: string) {
  const [row] = await getDb().select({ status: costingCases.status }).from(costingCases).where(eq(costingCases.id, caseId)).limit(1);
  if (!row) throw new Error("Costing case not found.");
  if (row.status !== "DRAFT") throw new Response("Submitted, approved and archived cases are read-only.", { status: 409 });
}

async function touchCase(caseId: string, currentStep?: number) {
  const values: { updatedAt: string; currentStep?: number } = { updatedAt: now() };
  if (currentStep) values.currentStep = currentStep;
  await getDb().update(costingCases).set(values).where(eq(costingCases.id, caseId));
}

export async function addAudit(caseId: string, actor: Actor, action: string, details: string, fromStatus: CaseStatus | null = null, toStatus: CaseStatus | null = null) {
  await getDb().insert(auditEvents).values({ id: uid(), caseId, actorId: actor.id, action, details, fromStatus, toStatus, createdAt: now() });
}

export async function listCases(): Promise<CostingCase[]> {
  await ensureDatabase();
  const rows = await getDb().select().from(costingCases).orderBy(desc(costingCases.updatedAt));
  return rows as CostingCase[];
}

export async function createCase(platformName: string, pricingPeriod: string, actor: Actor): Promise<CostingCaseAggregate> {
  await ensureDatabase();
  const db = getDb();
  await db.insert(actors).values(actor).onConflictDoNothing();
  const timestamp = now();
  const caseId = uid();
  await db.insert(costingCases).values({
    id: caseId,
    platformName,
    pricingPeriod,
    status: "DRAFT",
    formulaVersion: "RIC_FORMULA_V1",
    ownerId: actor.id,
    currentStep: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await db.insert(capabilities).values({ id: uid(), caseId, name: "Primary capability", billableUnit: "HOUR", active: true, displayOrder: 0 });
  await addAudit(caseId, actor, "CASE_CREATED", `Created ${platformName} costing case.`);
  return getCase(caseId);
}

export async function getCase(caseId: string): Promise<CostingCaseAggregate> {
  await ensureDatabase();
  const db = getDb();
  const [costingCase] = await db.select().from(costingCases).where(eq(costingCases.id, caseId)).limit(1);
  if (!costingCase) throw new Error("Costing case not found.");
  const [caseCapabilities, costs, income, capacity, rates, caseBenchmarks, snapshots, events] = await Promise.all([
    db.select().from(capabilities).where(eq(capabilities.caseId, caseId)).orderBy(capabilities.displayOrder),
    db.select().from(costLines).where(eq(costLines.caseId, caseId)),
    db.select().from(incomeLines).where(eq(incomeLines.caseId, caseId)),
    db.select().from(capacityPlans).where(eq(capacityPlans.caseId, caseId)),
    db.select().from(proposedRates).where(eq(proposedRates.caseId, caseId)),
    db.select().from(benchmarks).where(eq(benchmarks.caseId, caseId)),
    db.select().from(calculationSnapshots).where(eq(calculationSnapshots.caseId, caseId)).orderBy(desc(calculationSnapshots.createdAt)),
    db.select().from(auditEvents).where(eq(auditEvents.caseId, caseId)).orderBy(desc(auditEvents.createdAt)),
  ]);
  return {
    costingCase: costingCase as CostingCase,
    capabilities: caseCapabilities as Capability[],
    costs: costs as CostLine[],
    income: income as IncomeLine[],
    capacity: capacity as CapacityPlan[],
    proposedRates: rates as ProposedRate[],
    benchmarks: caseBenchmarks as Benchmark[],
    snapshots: snapshots as CalculationSnapshot[],
    auditEvents: events as AuditEvent[],
  };
}

export async function updateCase(caseId: string, values: Partial<Pick<CostingCase, "platformName" | "pricingPeriod" | "currentStep">>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  await getDb().update(costingCases).set({ ...values, updatedAt: now() }).where(eq(costingCases.id, caseId));
  await addAudit(caseId, actor, "CASE_UPDATED", "Updated case details.");
  return getCase(caseId);
}

export async function saveCapabilities(caseId: string, input: Array<Omit<Capability, "caseId" | "id"> & { id?: string }>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const db = getDb();
  const existing = await db.select().from(capabilities).where(eq(capabilities.caseId, caseId));
  const existingIds = new Set(existing.map((item) => item.id));
  const retainedIds = new Set<string>();
  for (const item of input) {
    const itemId = item.id && existingIds.has(item.id) ? item.id : uid();
    retainedIds.add(itemId);
    if (existingIds.has(itemId)) {
      await db.update(capabilities).set({ name: item.name, billableUnit: item.billableUnit, active: item.active, displayOrder: item.displayOrder }).where(and(eq(capabilities.id, itemId), eq(capabilities.caseId, caseId)));
    } else {
      await db.insert(capabilities).values({ id: itemId, caseId, name: item.name, billableUnit: item.billableUnit, active: item.active, displayOrder: item.displayOrder });
    }
  }
  const removed = existing.filter((item) => !retainedIds.has(item.id)).map((item) => item.id);
  if (removed.length) {
    await db.delete(costLines).where(inArray(costLines.capabilityId, removed));
    await db.delete(capacityPlans).where(inArray(capacityPlans.capabilityId, removed));
    await db.delete(proposedRates).where(inArray(proposedRates.capabilityId, removed));
    await db.delete(capabilities).where(inArray(capabilities.id, removed));
  }
  await touchCase(caseId, 2);
  await addAudit(caseId, actor, "CAPABILITIES_SAVED", `Saved ${input.length} capabilities.`);
  return getCase(caseId);
}

export async function saveCosts(caseId: string, rows: Array<Omit<CostLine, "caseId" | "id"> & { id?: string }>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const db = getDb();
  await db.delete(costLines).where(eq(costLines.caseId, caseId));
  if (rows.length) await db.insert(costLines).values(rows.map((row) => ({ ...row, id: row.id || uid(), caseId })));
  await touchCase(caseId, 3);
  await addAudit(caseId, actor, "COSTS_SAVED", `Saved ${rows.length} operating cost lines.`);
  return getCase(caseId);
}

export async function saveIncome(caseId: string, rows: Array<Omit<IncomeLine, "caseId" | "id"> & { id?: string }>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const db = getDb();
  await db.delete(incomeLines).where(eq(incomeLines.caseId, caseId));
  if (rows.length) await db.insert(incomeLines).values(rows.map((row) => ({ ...row, id: row.id || uid(), caseId })));
  await touchCase(caseId, 3);
  await addAudit(caseId, actor, "INCOME_SAVED", `Saved ${rows.length} non-variable income lines.`);
  return getCase(caseId);
}

export async function saveCapacity(caseId: string, rows: Array<Omit<CapacityPlan, "caseId" | "id" | "historicYear1" | "historicYear2" | "historicYear3"> & { id?: string; historicYear1?: string | null; historicYear2?: string | null; historicYear3?: string | null }>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const db = getDb();
  await db.delete(capacityPlans).where(eq(capacityPlans.caseId, caseId));
  await db.insert(capacityPlans).values(rows.map((row) => ({ ...row, id: row.id || uid(), caseId, historicYear1: row.historicYear1 || null, historicYear2: row.historicYear2 || null, historicYear3: row.historicYear3 || null })));
  await touchCase(caseId, 4);
  await addAudit(caseId, actor, "CAPACITY_SAVED", `Saved capacity plans for ${rows.length} capabilities.`);
  return getCase(caseId);
}

export async function saveProposedRates(caseId: string, rows: Array<Omit<ProposedRate, "caseId" | "id" | "uwaRate" | "apfrRate" | "commercialRate"> & { id?: string; uwaRate?: string | null; apfrRate?: string | null; commercialRate?: string | null }>, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const db = getDb();
  await db.delete(proposedRates).where(eq(proposedRates.caseId, caseId));
  await db.insert(proposedRates).values(rows.map((row) => ({ ...row, id: row.id || uid(), caseId, uwaRate: row.uwaRate || null, apfrRate: row.apfrRate || null, commercialRate: row.commercialRate || null })));
  await touchCase(caseId, 5);
  await addAudit(caseId, actor, "PROPOSED_RATES_SAVED", `Saved pricing scenarios for ${rows.length} capabilities.`);
  return getCase(caseId);
}

export async function createSnapshot(caseId: string, aggregate: CostingCaseAggregate, output: CalculationResult, actor: Actor) {
  await ensureDatabase();
  await assertEditable(caseId);
  const snapshot: CalculationSnapshot = {
    id: uid(),
    caseId,
    formulaVersion: "RIC_FORMULA_V1",
    inputJson: JSON.stringify({
      costingCase: aggregate.costingCase,
      capabilities: aggregate.capabilities,
      costs: aggregate.costs,
      income: aggregate.income,
      capacity: aggregate.capacity,
      proposedRates: aggregate.proposedRates,
    }),
    outputJson: JSON.stringify(output),
    createdBy: actor.id,
    createdAt: output.calculatedAt,
  };
  await getDb().insert(calculationSnapshots).values(snapshot);
  await touchCase(caseId, 5);
  await addAudit(caseId, actor, "CALCULATION_SNAPSHOT_CREATED", `Created immutable ${snapshot.formulaVersion} snapshot.`);
  return snapshot;
}

const ALLOWED_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  DRAFT: ["READY_FOR_REVIEW", "ARCHIVED"],
  READY_FOR_REVIEW: ["DRAFT", "APPROVED", "ARCHIVED"],
  APPROVED: ["ARCHIVED"],
  ARCHIVED: [],
};

export async function transitionStatus(caseId: string, target: CaseStatus, actor: Actor, comment: string) {
  const aggregate = await getCase(caseId);
  const current = aggregate.costingCase.status;
  if (!ALLOWED_TRANSITIONS[current].includes(target)) throw new Error(`Cannot move a case from ${current} to ${target}.`);
  if (target === "APPROVED" && actor.role !== "REVIEWER") throw new Response("Only the reviewer can approve a case.", { status: 403 });
  if (target === "READY_FOR_REVIEW" && actor.role !== "EDITOR") throw new Response("Only the editor can submit a draft.", { status: 403 });
  if (target === "ARCHIVED" && actor.role !== "EDITOR") throw new Response("Only the editor can archive a case.", { status: 403 });
  if ((target === "READY_FOR_REVIEW" || target === "APPROVED") && aggregate.snapshots.length === 0) throw new Response("Create a calculation snapshot before submitting or approving the case.", { status: 409 });
  await getDb().update(costingCases).set({ status: target, updatedAt: now() }).where(eq(costingCases.id, caseId));
  await addAudit(caseId, actor, "STATUS_CHANGED", comment || `Changed status from ${current} to ${target}.`, current, target);
  return getCase(caseId);
}

export async function duplicateCase(caseId: string, actor: Actor) {
  const source = await getCase(caseId);
  const duplicate = await createCase(`${source.costingCase.platformName} — copy`, source.costingCase.pricingPeriod, actor);
  const targetId = duplicate.costingCase.id;
  const mapped = new Map<string, string>();
  const copiedCapabilities = source.capabilities.map((item, index) => {
    const nextId = uid();
    mapped.set(item.id, nextId);
    return { ...item, id: nextId, caseId: targetId, displayOrder: index };
  });
  const db = getDb();
  await db.delete(capabilities).where(eq(capabilities.caseId, targetId));
  await db.insert(capabilities).values(copiedCapabilities);
  if (source.costs.length) await db.insert(costLines).values(source.costs.map((item) => ({ ...item, id: uid(), caseId: targetId, capabilityId: item.capabilityId ? mapped.get(item.capabilityId) || null : null })));
  if (source.income.length) await db.insert(incomeLines).values(source.income.map((item) => ({ ...item, id: uid(), caseId: targetId })));
  if (source.capacity.length) await db.insert(capacityPlans).values(source.capacity.map((item) => ({ ...item, id: uid(), caseId: targetId, capabilityId: mapped.get(item.capabilityId)! })));
  if (source.proposedRates.length) await db.insert(proposedRates).values(source.proposedRates.map((item) => ({ ...item, id: uid(), caseId: targetId, capabilityId: mapped.get(item.capabilityId)! })));
  await addAudit(targetId, actor, "CASE_DUPLICATED", `Duplicated from ${source.costingCase.platformName}; snapshots were intentionally not copied.`);
  return getCase(targetId);
}
