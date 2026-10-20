/** A student joins a class with a nickname. */
import { createJoinHandler } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ code: string }> }): Promise<Response> {
  const { code } = await ctx.params;
  return createJoinHandler(classDeps())(req, code);
}
