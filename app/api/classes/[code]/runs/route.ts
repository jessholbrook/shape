/**
 * POST: a student saves their runs to the class (see lib/server/class-runs.ts
 * for what counts as recorded). GET: the class's answers as this member may
 * see them, for the results page's run list.
 */
import { createSubmitRunsHandler } from "@/lib/server/class-runs";
import { createStudentAnswersHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createSubmitRunsHandler(classDeps())(req, code);
}

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createStudentAnswersHandler(classDeps())(req, code);
}
