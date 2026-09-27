import type { CalculationSnapshot, SnapshotInputPayload } from "@/src/modules/types";

/**
 * Picks the snapshot an export should be built from: a specific historical snapshot by id,
 * or the newest one when none is requested. Both PDF and CSV exports must resolve through
 * this so they can never disagree on which persisted snapshot they're representing.
 */
export function resolveExportSnapshot(
  snapshots: CalculationSnapshot[],
  requestedId?: string | null,
): CalculationSnapshot | undefined {
  return requestedId ? snapshots.find((item) => item.id === requestedId) : snapshots[0];
}

/**
 * Parses a snapshot's frozen inputs. Exports must read case fields (platform name, costs,
 * capacity, proposed rates) from here rather than from the live case, so a document generated
 * for an older snapshot never picks up edits made after that snapshot was taken.
 */
export function parseSnapshotInput(snapshot: CalculationSnapshot): SnapshotInputPayload {
  return JSON.parse(snapshot.inputJson) as SnapshotInputPayload;
}
