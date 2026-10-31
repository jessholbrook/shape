import { readClassConfig } from "../classroom";
import type { ClassDeps } from "./classroom-handler";
import { resendSender } from "./email";
import { supabaseRpc } from "./supabase";

/** Classroom dependencies from the environment, per request (env can change between deploys). */
export function classDeps(): ClassDeps {
  const config = readClassConfig(process.env);
  if (!config.enabled) return { config, rpc: null, env: process.env };
  return {
    config,
    rpc: supabaseRpc(config.supabaseUrl, config.supabaseKey),
    send: resendSender(config.resendKey, config.emailFrom),
    env: process.env,
  };
}
