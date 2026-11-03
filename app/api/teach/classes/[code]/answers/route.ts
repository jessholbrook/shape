/** Every answer in the teacher's class, for the results page's run list. */
import { createTeacherAnswersHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createTeacherAnswersHandler(classDeps())(req, code);
}
