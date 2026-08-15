import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveCosts } from "@/src/modules/repository";
import { costsSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, costsSchema);
    return noStoreJson({ case: await saveCosts((await context.params).id, input.costs, actor) });
  } catch (error) { return jsonError(error); }
}
