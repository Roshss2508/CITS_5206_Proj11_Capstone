import { getDemoActor } from "@/src/modules/auth";
import { jsonError, noStoreJson, parseJson } from "@/src/modules/api";
import { transitionStatus } from "@/src/modules/repository";
import { statusSchema } from "@/src/modules/validation";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  try {
    const actor = getDemoActor(request);
    const input = await parseJson(request, statusSchema);
    return noStoreJson({ case: await transitionStatus((await context.params).id, input.status, actor, input.comment) });
  } catch (error) { return jsonError(error); }
}
