import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { getCase, updateCase } from "@/src/modules/repository";
import { updateCaseSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  try { return noStoreJson({ case: await getCase((await context.params).id) }); } catch (error) { return jsonError(error); }
}

export async function PATCH(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request);
    requireRole(actor, "EDITOR");
    const input = await parseJson(request, updateCaseSchema);
    return noStoreJson({ case: await updateCase((await context.params).id, input, actor) });
  } catch (error) { return jsonError(error); }
}
