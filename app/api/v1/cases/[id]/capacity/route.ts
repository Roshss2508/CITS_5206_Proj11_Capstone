import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveCapacity } from "@/src/modules/repository";
import { capacitySchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, capacitySchema);
    return noStoreJson({ case: await saveCapacity((await context.params).id, input.capacity, actor) });
  } catch (error) { return jsonError(error); }
}
