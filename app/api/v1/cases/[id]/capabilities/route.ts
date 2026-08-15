import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveCapabilities } from "@/src/modules/repository";
import { capabilitiesSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, capabilitiesSchema);
    return noStoreJson({ case: await saveCapabilities((await context.params).id, input.capabilities, actor) });
  } catch (error) { return jsonError(error); }
}
