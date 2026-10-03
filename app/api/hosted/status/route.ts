/** Whether the free tier is usable right now, and how many runs this visitor has left today. */
import { readHostedConfig } from "@/lib/hosted";
import { createStatusHandler } from "@/lib/server/hosted-handler";
import { supabaseRpc } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function GET(req: Request): Promise<Response> {
  const config = readHostedConfig(process.env);
  const rpc = config.enabled ? supabaseRpc(config.supabaseUrl, config.supabaseKey) : null;
  return createStatusHandler({ config, rpc })(req);
}
