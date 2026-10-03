import { clientIp, forbidden, isSameOrigin, rateLimit, tooManyRequests } from "../api-guard";
import { buildManifest, manifestHash, ranAtOf, validateExperiment, type Manifest } from "../experiment";
import { periodKeys } from "../hosted";
import { isLensId } from "../lenses";
import {
  SHARE_LIMITS,
  isDeleteToken,
  isSlug,
  newDeleteToken,
  newSlug,
  sha256Hex,
  validateShareRequest,
  type ShareConfig,
  type SharedExperiment,
} from "../sharing";
import { hmac } from "./identity";
import type { Rpc } from "./supabase";

/**
 * Sharing's request paths, with I/O passed in so tests run them against
 * fakes. app/api/share/* and app/e/[slug] wire in the real Supabase client.
 *
 * The server builds the manifest itself from the published experiment, so a
 * share's manifest always describes the design and runs actually stored.
 */

export type ShareDeps = {
  config: ShareConfig;
  rpc: Rpc | null;
  now?: () => Date;
  /** Recorded in the manifest. */
  appVersion?: string;
  /** Tests pass fixed randomness. */
  random?: (n: number) => Uint8Array;
};

/** Speed bump per instance; the per-network daily allowance is the real limit. */
const BURST_LIMIT = 10;
const BURST_WINDOW_MS = 60 * 1000;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const error = (status: number, message: string) => json(status, { error: { message } });

const OFF_MESSAGE = "Sharing isn't available right now. You can still download the experiment as JSON.";

/** POST /api/share — publish a snapshot; returns its slug and the delete token (shown once). */
export function createPublishHandler(deps: ShareDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return error(503, OFF_MESSAGE);
    if (!isSameOrigin(req)) return forbidden();

    const ip = clientIp(req);
    const gate = rateLimit(`share:${ip}`, BURST_LIMIT, BURST_WINDOW_MS, now().getTime());
    if (!gate.ok) return tooManyRequests(gate.retryAfter);

    const raw = await req.text();
    if (raw.length > SHARE_LIMITS.maxBodyBytes) return error(413, "This experiment is too large to share. Try fewer runs per cell.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return error(400, "Body must be JSON.");
    }
    const v = validateShareRequest(body);
    if (!v.ok) return error(400, v.message);
    const { experiment, runner } = v.request;

    const manifest = buildManifest(experiment, { appVersion: deps.appVersion ?? "local", ranAt: ranAtOf(experiment), runner });
    const hash = await manifestHash(manifest);
    const slug = newSlug(deps.random);
    const deleteToken = newDeleteToken(deps.random);
    const { day } = periodKeys(now());

    let result: { ok: boolean; reason?: string };
    try {
      result = await deps.rpc("publish_experiment", {
        p_slug: slug,
        p_title: experiment.title,
        p_lens: experiment.lens ?? null,
        p_experiment: experiment,
        p_manifest: manifest,
        p_hash: hash,
        p_delete_hash: await sha256Hex(deleteToken),
        p_network: `p:${await hmac(config.hashSecret, `publish:${day}:${ip}`)}`,
        p_day: day,
        p_limit: config.dailyPublishes,
      });
    } catch (err) {
      console.error("share: publish failed", err instanceof Error ? err.message : err);
      return error(503, OFF_MESSAGE);
    }
    if (!result.ok) {
      return error(429, `This network has shared ${config.dailyPublishes} experiments today, the daily limit. Try again tomorrow, or download the JSON instead.`);
    }
    return json(201, { slug, deleteToken, manifestHash: hash });
  };
}

/** DELETE /api/share/<slug> — with the token from publishing, in x-delete-token. */
export function createDeleteHandler(deps: Omit<ShareDeps, "appVersion" | "random">) {
  return async function DELETE(req: Request, slug: string): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return error(503, OFF_MESSAGE);
    if (!isSameOrigin(req)) return forbidden();
    const token = req.headers.get("x-delete-token");
    if (!isSlug(slug) || !isDeleteToken(token)) return error(404, "No such shared experiment, or it's already gone.");
    try {
      const deleted = await deps.rpc<boolean>("delete_shared_experiment", { p_slug: slug, p_delete_hash: await sha256Hex(token) });
      return deleted ? new Response(null, { status: 204 }) : error(404, "No such shared experiment, or it's already gone.");
    } catch (err) {
      console.error("share: delete failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't delete it right now. Try again in a minute.");
    }
  };
}

export type LoadResult = { status: "ok"; shared: SharedExperiment } | { status: "missing" } | { status: "unavailable" };

/** For the /e/<slug> page. "Unavailable" (database down) is not "missing" — the page says which. */
export async function loadShared(deps: Pick<ShareDeps, "config" | "rpc">, slug: string): Promise<LoadResult> {
  if (!isSlug(slug)) return { status: "missing" };
  if (!deps.config.enabled || !deps.rpc) return { status: "unavailable" };
  let row: Record<string, unknown> | null;
  try {
    row = await deps.rpc<Record<string, unknown> | null>("get_shared_experiment", { p_slug: slug });
  } catch (err) {
    console.error("share: load failed", err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
  if (!row) return { status: "missing" };
  // Stored data is re-checked on the way out: a bad row renders as missing, not as a crash.
  const v = validateExperiment(row.experiment);
  if (!v.ok || typeof row.manifest_hash !== "string" || !row.manifest || typeof row.created_at !== "string") {
    return { status: "missing" };
  }
  return {
    status: "ok",
    shared: {
      slug,
      title: String(row.title ?? v.experiment.title),
      lens: isLensId(row.lens) ? row.lens : null,
      experiment: v.experiment,
      manifest: row.manifest as Manifest,
      manifestHash: row.manifest_hash,
      createdAt: row.created_at,
    },
  };
}

/** GET /api/share — whether the Share button should show. */
// Once per instance: an intentionally-off feature shouldn't log on every page view.
let warnedOff = false;

export function createShareStatusHandler(deps: Pick<ShareDeps, "config">) {
  return async function GET(): Promise<Response> {
    if (!deps.config.enabled && !warnedOff) {
      warnedOff = true;
      console.warn(`share: sharing off — ${deps.config.reason}`);
    }
    return json(200, { enabled: deps.config.enabled });
  };
}
