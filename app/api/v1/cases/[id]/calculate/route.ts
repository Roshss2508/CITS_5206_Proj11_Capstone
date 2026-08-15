import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson } from "@/src/modules/api";
import { calculateCase } from "@/src/modules/calculation";
import { createSnapshot, getCase } from "@/src/modules/repository";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const id = (await context.params).id;
    const aggregate = await getCase(id);
    const result = calculateCase(aggregate);
    const snapshot = await createSnapshot(id, aggregate, result, actor);
    return noStoreJson({ result, snapshot }, { status: 201 });
  } catch (error) { return jsonError(error); }
}
