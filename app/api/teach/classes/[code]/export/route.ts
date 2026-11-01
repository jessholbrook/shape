/** The teacher downloads every run in their class, as CSV or JSON. */
import { createExportHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createExportHandler(classDeps())(req, code);
}
