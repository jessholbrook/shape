/**
 * The free tier: Claude Haiku 4.5 on Shape's key, metered per visitor per
 * day and capped per month. Off unless SHAPE_FREE_TIER=on and every secret is
 * set — see lib/hosted.ts for the switches and lib/server/hosted-handler.ts
 * for the request path.
 */
import { readHostedConfig } from "@/lib/hosted";
import { createHostedHandler } from "@/lib/server/hosted-handler";
import { supabaseRpc } from "@/lib/server/supabase";
import { anthropicStream } from "@/lib/server/anthropic-stream";

export const dynamic = "force-dynamic";
// Long enough for a full 1,024-token reply plus the settle step.
export const maxDuration = 60;

export async function POST(req: Request): Promise<Response> {
  const config = readHostedConfig(process.env);
  const rpc = config.enabled ? supabaseRpc(config.supabaseUrl, config.supabaseKey) : null;
  return createHostedHandler({ config, rpc, stream: anthropicStream })(req);
}
