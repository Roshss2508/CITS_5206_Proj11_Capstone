import { jsonError } from "@/src/modules/api";
import { getCase } from "@/src/modules/repository";
import type { CalculationResult } from "@/src/modules/types";

type Context = { params: Promise<{ id: string }> };
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(_: Request, context: Context) {
  try {
    const aggregate = await getCase((await context.params).id);
    const snapshot = aggregate.snapshots[0];
    if (!snapshot) return Response.json({ error: "Create a calculation snapshot before exporting CSV." }, { status: 409 });
    const result = JSON.parse(snapshot.outputJson) as CalculationResult;
    const rows = [["Capability", "Unit", "Forecast units", "Operating cost", "UWA rate", "APFR rate", "Commercial rate", "Operating balance"], ...result.capabilities.map((item) => [item.capabilityName, item.billableUnit, item.forecastUnits, item.totalOperatingCost, item.sustainableRates.UWA, item.sustainableRates.APFR, item.sustainableRates.COMMERCIAL, item.operatingBalance])];
    const body = rows.map((row) => row.map(csv).join(",")).join("\r\n");
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ric-calculation.csv", "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
