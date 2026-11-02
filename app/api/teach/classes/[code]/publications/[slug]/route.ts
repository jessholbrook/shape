/** The teacher takes one of the class's published results down. */
import { createUnpublishClassHandler } from "@/lib/server/class-results";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ code: string; slug: string }> }): Promise<Response> {
  const { code, slug } = await ctx.params;
  return createUnpublishClassHandler(classDeps())(req, code, slug);
}
