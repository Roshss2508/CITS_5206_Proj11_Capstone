import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { jsonError } from "@/src/modules/api";
import { getCase } from "@/src/modules/repository";
import type { CalculationResult } from "@/src/modules/types";

type Context = { params: Promise<{ id: string }> };
const safe = (value: string) => value.replace(/[^\x20-\x7E]/g, "?");

export async function GET(request: Request, context: Context) {
  try {
    const aggregate = await getCase((await context.params).id);
    const requested = new URL(request.url).searchParams.get("snapshot");
    const snapshot = requested ? aggregate.snapshots.find((item) => item.id === requested) : aggregate.snapshots[0];
    if (!snapshot) return Response.json({ error: "Create a calculation snapshot before exporting a report." }, { status: 409 });
    const result = JSON.parse(snapshot.outputJson) as CalculationResult;
    const document = await PDFDocument.create();
    const regular = await document.embedFont(StandardFonts.Helvetica);
    const bold = await document.embedFont(StandardFonts.HelveticaBold);
    const navy = rgb(0.04, 0.16, 0.28);
    let page = document.addPage([612, 792]);
    let y = 735;
    const line = (label: string, value?: string, strong = false) => {
      if (y < 60) { page = document.addPage([612, 792]); y = 735; }
      page.drawText(safe(value ? `${label}: ${value}` : label), { x: 54, y, size: strong ? 15 : 10, font: strong ? bold : regular, color: strong ? navy : rgb(0.12, 0.18, 0.24) });
      y -= strong ? 25 : 17;
    };
    line("RESEARCH INFRASTRUCTURE COSTING & PRICING", undefined, true);
    line(aggregate.costingCase.platformName, undefined, true);
    line("Pricing period", aggregate.costingCase.pricingPeriod);
    line("Case status", aggregate.costingCase.status);
    line("Formula version", snapshot.formulaVersion);
    line("Snapshot created", new Date(snapshot.createdAt).toLocaleString("en-AU"));
    y -= 10;
    line("PLATFORM SUMMARY", undefined, true);
    line("Gross user revenue", `$${result.grossRevenue}`);
    line("University overhead", `$${result.universityOverhead}`);
    line("Net platform recovery", `$${result.netPlatformRecovery}`);
    line("Operating balance", `$${result.operatingBalance}`);
    for (const capability of result.capabilities) {
      y -= 12;
      line(capability.capabilityName, undefined, true);
      line("Forecast billable units", `${capability.forecastUnits} ${capability.billableUnit.toLowerCase()}`);
      line("Total operating cost", `$${capability.totalOperatingCost}`);
      line("UWA sustainable rate", `$${capability.sustainableRates.UWA}`);
      line("APFR sustainable rate", `$${capability.sustainableRates.APFR}`);
      line("Commercial sustainable rate", `$${capability.sustainableRates.COMMERCIAL}`);
      line("Proposed UWA / APFR / Commercial", `$${capability.proposedRates.UWA} / $${capability.proposedRates.APFR} / $${capability.proposedRates.COMMERCIAL}`);
      line("Capability operating balance", `$${capability.operatingBalance}`);
    }
    if (result.warnings.length) {
      y -= 12; line("WARNINGS", undefined, true);
      result.warnings.forEach((warning, index) => line(`${index + 1}`, warning));
    }
    y -= 12; line("ASSUMPTIONS & EVIDENCE", undefined, true);
    aggregate.costs.forEach((item) => line(item.label, `${item.justification} ($${item.amount})`));
    aggregate.capacity.forEach((item) => line("Utilisation", item.justification));
    aggregate.proposedRates.forEach((item) => line("Proposed rates", item.justification));
    const bytes = await document.save();
    const filename = aggregate.costingCase.platformName.replace(/[^a-z0-9-_]+/gi, "-").replace(/^-|-$/g, "").slice(0, 60) || "ric-case";
    return new Response(bytes.buffer as ArrayBuffer, { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${filename}-snapshot.pdf"`, "Cache-Control": "private, no-store" } });
  } catch (error) { return jsonError(error); }
}
