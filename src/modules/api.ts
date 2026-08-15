import { ZodError, type ZodType } from "zod";

export async function parseJson<T>(request: Request, schema: ZodType<T>): Promise<T> {
  return schema.parse(await request.json());
}

export function jsonError(error: unknown) {
  if (error instanceof Response) return error;
  if (error instanceof ZodError) {
    return Response.json({ error: "Please correct the highlighted information.", issues: error.issues }, { status: 400 });
  }
  const message = error instanceof Error ? error.message : "Unexpected server error.";
  const status = message.includes("not found") ? 404 : 500;
  return Response.json({ error: message }, { status });
}

export function noStoreJson(data: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}
