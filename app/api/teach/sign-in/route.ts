/** Email an allowlisted teacher a one-time sign-in link. */
import { createSignInHandler } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return createSignInHandler(classDeps())(req);
}
