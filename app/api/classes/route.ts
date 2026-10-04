/** A signed-in teacher turns a lab experiment into a class. */
import { createClassHandler } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return createClassHandler(classDeps())(req);
}
