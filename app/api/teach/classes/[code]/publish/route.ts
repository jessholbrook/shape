/** The teacher publishes the class's pooled results as an unlisted shared page. */
import { createPublishClassHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createPublishClassHandler(classDeps())(req, code);
}
