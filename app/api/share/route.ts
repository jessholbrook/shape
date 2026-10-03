/**
 * Sharing a lab experiment to an unlisted link. GET says whether sharing is
 * on; POST publishes. Off unless SHAPE_SHARING=on and the Supabase settings
 * are present — see lib/sharing.ts and lib/server/share-handler.ts.
 */
import { readShareConfig } from "@/lib/sharing";
import { createPublishHandler, createShareStatusHandler } from "@/lib/server/share-handler";
import { supabaseRpc } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  return createShareStatusHandler({ config: readShareConfig(process.env) })();
}

export async function POST(req: Request): Promise<Response> {
  const config = readShareConfig(process.env);
  const rpc = config.enabled ? supabaseRpc(config.supabaseUrl, config.supabaseKey) : null;
  return createPublishHandler({ config, rpc, appVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "local" })(req);
}
