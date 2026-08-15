import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { createCase, listCases } from "@/src/modules/repository";
import { createCaseSchema } from "@/src/modules/validation";

export async function GET() {
  try { return noStoreJson({ cases: await listCases() }); } catch (error) { return jsonError(error); }
}

export async function POST(request: Request) {
  try {
    const actor = getDemoActor(request);
    requireRole(actor, "EDITOR");
    const input = await parseJson(request, createCaseSchema);
    return noStoreJson({ case: await createCase(input.platformName, input.pricingPeriod, actor) }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
