/** What a student has left today in this class, for the run preflight. */
import { createClassStatusHandler } from "@/lib/server/class-runs";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createClassStatusHandler(classDeps())(req, code);
}
