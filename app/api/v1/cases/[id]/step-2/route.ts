import { getDemoActor, requireRole } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { saveCostsAndIncome } from "@/src/modules/repository";
import { step2Schema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request); requireRole(actor, "EDITOR");
    const input = await parseJson(request, step2Schema);
    return noStoreJson({ case: await saveCostsAndIncome((await context.params).id, input.costs, input.income, actor) });
  } catch (error) { return jsonError(error); }
}
