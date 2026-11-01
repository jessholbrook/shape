/** The teacher closes or reopens their class. */
import { createSetStatusHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createSetStatusHandler(classDeps())(req, code);
}
