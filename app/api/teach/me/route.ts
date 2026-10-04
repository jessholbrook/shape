/** Is classrooms on, and is a teacher signed in? */
import { createMeHandler } from "@/lib/server/classroom-handler";
import { classDeps } from "@/lib/server/classroom-deps";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  return createMeHandler(classDeps())(req);
}
