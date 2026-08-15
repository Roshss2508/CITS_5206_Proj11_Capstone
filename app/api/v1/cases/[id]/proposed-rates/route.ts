import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveProposedRates } from "@/src/modules/repository";
import { proposedRatesSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, proposedRatesSchema);
    return noStoreJson({ case: await saveProposedRates((await context.params).id, input.proposedRates, actor) });
  } catch (error) { return jsonError(error); }
}
