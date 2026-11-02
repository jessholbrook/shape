import { readClassConfig } from "../classroom";
import { readHostedConfig } from "../hosted";
import { readShareConfig } from "../sharing";
import type { ClassDeps } from "./classroom-handler";
import { resendSender } from "./email";
import { supabaseRpc } from "./supabase";

/** Classroom dependencies from the environment, per request (env can change between deploys). */
export function classDeps(): ClassDeps {
  const config = readClassConfig(process.env);
  if (!config.enabled) return { config, rpc: null, env: process.env };
  const hosted = readHostedConfig(process.env);
  return {
    config,
    rpc: supabaseRpc(config.supabaseUrl, config.supabaseKey),
    send: resendSender(config.resendKey, config.emailFrom),
    env: process.env,
    freeTier: hosted.enabled,
    memberDailyCalls: hosted.enabled ? hosted.classMemberDailyCalls : undefined,
    sharing: (() => {
      const share = readShareConfig(process.env);
      return share.enabled ? { enabled: true, dailyPublishes: share.dailyPublishes } : { enabled: false, dailyPublishes: 0 };
    })(),
    appVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
  };
}
