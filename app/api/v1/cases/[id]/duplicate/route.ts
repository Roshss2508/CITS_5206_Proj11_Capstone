import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson } from "@/src/modules/api";
import { duplicateCase } from "@/src/modules/repository";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    return noStoreJson({ case: await duplicateCase((await context.params).id, actor) }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
