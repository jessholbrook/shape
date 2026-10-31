/** A student saves their runs to the class. See lib/server/class-runs.ts for what counts as recorded. */
import { createSubmitRunsHandler } from "@/lib/server/class-runs";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createSubmitRunsHandler(classDeps())(req, code);
}
