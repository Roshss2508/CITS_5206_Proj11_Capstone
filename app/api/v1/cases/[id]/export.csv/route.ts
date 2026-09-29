import { getActorName } from "@/src/modules/auth";
import { jsonError } from "@/src/modules/api";
import { resolveExportSnapshot } from "@/src/modules/exportSnapshot";
import { getCase } from "@/src/modules/repository";
import type { CalculationResult } from "@/src/modules/types";

type Context = { params: Promise<{ id: string }> };
const csv = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
export async function GET(request: Request, context: Context) {
  try {
    const aggregate = await getCase((await context.params).id);
    const requested = new URL(request.url).searchParams.get("snapshot");
    if (requested && !aggregate.snapshots.some((item) => item.id === requested)) {
      return Response.json({ error: "Snapshot not found." }, { status: 404 });
    }
    const snapshot = resolveExportSnapshot(aggregate.snapshots, requested);
    if (!snapshot) return Response.json({ error: "Create a calculation snapshot before exporting CSV." }, { status: 409 });
    const result = JSON.parse(snapshot.outputJson) as CalculationResult;
    const rows = [
      ["Snapshot created", new Date(snapshot.createdAt).toLocaleString("en-AU")],
      ["Formula version", snapshot.formulaVersion],
      ["Created by", getActorName(snapshot.createdBy)],
      [],
      ["Capability", "Unit", "Forecast units", "Operating cost", "UWA rate", "APFR rate", "Commercial rate", "Operating balance"],
      ...result.capabilities.map((item) => [item.capabilityName, item.billableUnit, item.forecastUnits, item.totalOperatingCost, item.sustainableRates.UWA, item.sustainableRates.APFR, item.sustainableRates.COMMERCIAL, item.operatingBalance]),
    ];
    const body = rows.map((row) => row.map(csv).join(",")).join("\r\n");
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": "attachment; filename=ric-calculation.csv", "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
