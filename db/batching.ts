// D1 limits each statement, including statements inside a batch, to 100 binds.
// https://developers.cloudflare.com/d1/platform/limits/
const D1_MAX_BOUND_PARAMETERS = 100;

export function chunkInsertRows<T>(rows: T[], columnsPerRow: number): T[][] {
  if (!Number.isInteger(columnsPerRow) || columnsPerRow < 1 || columnsPerRow > D1_MAX_BOUND_PARAMETERS) {
    throw new Error("An insert row must fit within D1's bound-parameter limit.");
  }
  const rowsPerStatement = Math.floor(D1_MAX_BOUND_PARAMETERS / columnsPerRow);
  const chunks: T[][] = [];
  for (let offset = 0; offset < rows.length; offset += rowsPerStatement) {
    chunks.push(rows.slice(offset, offset + rowsPerStatement));
  }
  return chunks;
}
