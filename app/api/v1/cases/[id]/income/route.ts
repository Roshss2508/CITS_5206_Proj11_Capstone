import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveIncome } from "@/src/modules/repository";
import { incomeSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, incomeSchema);
    return noStoreJson({ case: await saveIncome((await context.params).id, input.income, actor) });
  } catch (error) { return jsonError(error); }
}
