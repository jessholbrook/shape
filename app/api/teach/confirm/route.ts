/** Trade a sign-in link's token for a teacher session cookie. */
import { createConfirmHandler } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return createConfirmHandler(classDeps())(req);
}
