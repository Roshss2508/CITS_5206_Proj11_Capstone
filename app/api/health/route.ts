export async function GET() {
  return Response.json({ status: "ok", service: "ric-costing-tool", formulaVersion: "RIC_FORMULA_V1" });
}
