import { inflateSync } from "node:zlib";
import { expect, test, type APIRequestContext } from "@playwright/test";

const EDITOR = { "x-demo-role": "EDITOR" };

/**
 * pdf-lib compresses each content stream with FlateDecode and renders drawn text as either a
 * hex string (`<...>`) or a literal string (`(...)`) before the `Tj`/`TJ` show-text operator.
 * Decompressing and pulling those strings out is enough to assert what text actually ended up
 * in the PDF, without pulling in a PDF-parsing dependency just for this test.
 */
function extractPdfText(bytes: Buffer): string {
  const raw = bytes.toString("latin1");
  let decoded = "";
  const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let streamMatch: RegExpExecArray | null;
  while ((streamMatch = streamRe.exec(raw))) {
    try {
      decoded += inflateSync(Buffer.from(streamMatch[1], "latin1")).toString("latin1");
    } catch {
      decoded += streamMatch[1];
    }
  }

  const strings: string[] = [];
  const hexRe = /<([0-9A-Fa-f]+)>\s*Tj/g;
  let hexMatch: RegExpExecArray | null;
  while ((hexMatch = hexRe.exec(decoded))) strings.push(Buffer.from(hexMatch[1], "hex").toString("latin1"));

  const literalRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj/g;
  let literalMatch: RegExpExecArray | null;
  while ((literalMatch = literalRe.exec(decoded))) strings.push(literalMatch[1].replace(/\\(.)/g, "$1"));

  return strings.join(" ");
}

async function createCalculatedCase(request: APIRequestContext, justification: string) {
  const created = await request.post("/api/v1/cases", {
    headers: EDITOR,
    data: { platformName: `QA Export Consistency ${Date.now()}`, pricingPeriod: "2027-2029" },
  });
  expect(created.status()).toBe(201);
  const body = await created.json();
  const caseId = body.case.costingCase.id as string;
  const capabilityId = body.case.capabilities[0].id as string;

  const responses = [
    await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/income`, { headers: EDITOR, data: { income: [] } }),
    await request.put(`/api/v1/cases/${caseId}/capacity`, {
      headers: EDITOR,
      data: { capacity: [{ capabilityId, maximumCapacity: "1000", forecastUtilisationPct: "50", historicYear1: null, historicYear2: null, historicYear3: null, justification: "Export consistency test." }] },
    }),
    await request.put(`/api/v1/cases/${caseId}/proposed-rates`, {
      headers: EDITOR,
      data: { proposedRates: [{ capabilityId, uwaRate: null, apfrRate: null, commercialRate: null, uwaSharePct: "60", apfrSharePct: "25", commercialSharePct: "15", justification: "Export consistency test." }] },
    }),
  ];
  for (const response of responses) expect(response.status()).toBe(200);

  const calculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
  expect(calculated.status()).toBe(201);
  const snapshotId = (await calculated.json()).snapshot.id as string;
  return { caseId, capabilityId, snapshotId };
}

async function fetchPdfText(request: APIRequestContext, caseId: string, snapshotId?: string) {
  const url = snapshotId ? `/api/v1/cases/${caseId}/report.pdf?snapshot=${snapshotId}` : `/api/v1/cases/${caseId}/report.pdf`;
  const response = await request.get(url);
  expect(response.status()).toBe(200);
  return extractPdfText(Buffer.from(await response.body()));
}

test.describe("Issue #41 – PDF exports stay pinned to their persisted snapshot", () => {
  let caseId: string | undefined;

  test.afterEach(async ({ request }) => {
    if (!caseId) return;
    await request.post(`/api/v1/cases/${caseId}/status`, { headers: EDITOR, data: { status: "ARCHIVED", comment: "Archived by automated E2E teardown." } });
    caseId = undefined;
  });

  test("editing evidence after a snapshot is taken does not leak into that snapshot's PDF", async ({ request }) => {
    const created = await createCalculatedCase(request, "ORIGINAL_JUSTIFICATION_MARKER");
    caseId = created.caseId;

    const immediately = await fetchPdfText(request, caseId, created.snapshotId);
    expect(immediately).toContain("ORIGINAL_JUSTIFICATION_MARKER");

    // Reword the evidence without recalculating - the case is still DRAFT and editable.
    const edited = await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: created.capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification: "EDITED_AFTER_SNAPSHOT_MARKER" }] },
    });
    expect(edited.status()).toBe(200);

    for (const snapshotId of [created.snapshotId, undefined]) {
      const text = await fetchPdfText(request, caseId, snapshotId);
      expect(text, "PDF for the original snapshot must still show the frozen evidence").toContain("ORIGINAL_JUSTIFICATION_MARKER");
      expect(text, "PDF for the original snapshot must not pick up the live edit").not.toContain("EDITED_AFTER_SNAPSHOT_MARKER");
    }
  });

  test("a later recalculation does not retroactively change an earlier snapshot's PDF", async ({ request }) => {
    const created = await createCalculatedCase(request, "SNAPSHOT_ONE_MARKER");
    caseId = created.caseId;

    const edited = await request.put(`/api/v1/cases/${caseId}/costs`, {
      headers: EDITOR,
      data: { costs: [{ capabilityId: created.capabilityId, category: "STAFFING", scope: "CAPABILITY", label: "Staffing", amount: "10000", justification: "SNAPSHOT_TWO_MARKER" }] },
    });
    expect(edited.status()).toBe(200);

    const recalculated = await request.post(`/api/v1/cases/${caseId}/calculate`, { headers: EDITOR });
    expect(recalculated.status()).toBe(201);
    const secondSnapshotId = (await recalculated.json()).snapshot.id as string;
    expect(secondSnapshotId).not.toBe(created.snapshotId);

    const latest = await fetchPdfText(request, caseId);
    expect(latest).toContain("SNAPSHOT_TWO_MARKER");
    expect(latest).not.toContain("SNAPSHOT_ONE_MARKER");

    const historical = await fetchPdfText(request, caseId, created.snapshotId);
    expect(historical, "the older snapshot's PDF must remain exactly as it was").toContain("SNAPSHOT_ONE_MARKER");
    expect(historical).not.toContain("SNAPSHOT_TWO_MARKER");
  });

  test("returns 404 for a snapshot id that does not belong to the case", async ({ request }) => {
    const created = await createCalculatedCase(request, "PDF_404_MARKER");
    caseId = created.caseId;

    const response = await request.get(`/api/v1/cases/${caseId}/report.pdf?snapshot=does-not-exist`);
    expect(response.status()).toBe(404);
    expect((await response.json()).error).toBe("Snapshot not found.");
  });
});
