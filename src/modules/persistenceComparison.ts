import Decimal from "decimal.js";

/** Compare decimal values without changing the stored representation or rounding. */
export function persistenceNumber(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return new Decimal(value).toFixed();
}

/**
 * Compare unordered collections, preserving duplicate multiplicity and explicit
 * identities. Callers project ALL persisted fields, including evidence. Unlike
 * calculationFingerprint, this must never discard labels or justifications.
 * Missing IDs match by content for compatible clients that omit optional IDs.
 */
export function samePersistedRows<Existing extends { id?: string }, Incoming extends { id?: string }>(
  existing: readonly Existing[], incoming: readonly Incoming[], project: (row: Existing | Incoming) => readonly unknown[],
): boolean {
  if (existing.length !== incoming.length) return false;
  const remaining = new Map(existing.map((row) => [row.id, JSON.stringify(project(row))]));
  if (remaining.size !== existing.length) return false;
  for (const row of incoming.filter((item) => item.id)) {
    if (!remaining.has(row.id) || remaining.get(row.id) !== JSON.stringify(project(row))) return false;
    remaining.delete(row.id);
  }
  const counts = new Map<string, number>();
  for (const signature of remaining.values()) counts.set(signature, (counts.get(signature) ?? 0) + 1);
  for (const row of incoming.filter((item) => !item.id)) {
    const signature = JSON.stringify(project(row));
    const count = counts.get(signature) ?? 0;
    if (count === 0) return false;
    counts.set(signature, count - 1);
  }
  return true;
}
