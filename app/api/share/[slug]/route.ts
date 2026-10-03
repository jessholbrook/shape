/** Delete a shared experiment, with the token its publisher's browser kept. */
import { readShareConfig } from "@/lib/sharing";
import { createDeleteHandler } from "@/lib/server/share-handler";
import { supabaseRpc } from "@/lib/server/supabase";

export const dynamic = "force-dynamic";

export async function DELETE(req: Request, ctx: { params: Promise<{ slug: string }> }): Promise<Response> {
  const { slug } = await ctx.params;
  const config = readShareConfig(process.env);
  const rpc = config.enabled ? supabaseRpc(config.supabaseUrl, config.supabaseKey) : null;
  return createDeleteHandler({ config, rpc })(req, slug);
}
