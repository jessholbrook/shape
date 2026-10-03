import { validateExperiment, type Experiment, type Manifest, type Runner } from "./experiment";
import { isLensId, type LensId } from "./lenses";
import { newId } from "./spread";

/**
 * Sharing a lab experiment as an unlisted, read-only link: what may be
 * published, how links and delete tokens are made, and how a reader turns a
 * share into their own rerun. Pure — the server handler and the UI both use it.
 *
 * A share is a snapshot: the design, the runs that finished, and a manifest
 * the server builds from them. No keys exist on an Experiment, so none can
 * leak; what *can* leak is whatever the publisher typed into prompts, which
 * is why the UI asks them to confirm before publishing.
 */

export type ShareConfig =
  | {
      enabled: true;
      supabaseUrl: string;
      supabaseKey: string;
      hashSecret: string;
      /** Publishes per network per day. */
      dailyPublishes: number;
    }
  | { enabled: false; reason: string };

type Env = Record<string, string | undefined>;

/** Off unless SHAPE_SHARING is "on" and the database settings are present. */
export function readShareConfig(env: Env): ShareConfig {
  if (env.SHAPE_SHARING?.trim().toLowerCase() !== "on") {
    return { enabled: false, reason: 'switched off (SHAPE_SHARING is not "on")' };
  }
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "QUOTA_HASH_SECRET"].filter((k) => !env[k]?.trim());
  if (missing.length) return { enabled: false, reason: `missing ${missing.join(", ")}` };
  const limit = Number(env.SHARE_DAILY_LIMIT);
  return {
    enabled: true,
    supabaseUrl: env.SUPABASE_URL!.trim().replace(/\/$/, ""),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    hashSecret: env.QUOTA_HASH_SECRET!.trim(),
    dailyPublishes: Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 20,
  };
}

export const SHARE_LIMITS = {
  /** A 60-call experiment with long answers is ~150KB; this leaves room without hosting files. */
  maxBodyBytes: 1_000_000,
  maxRuns: 2000,
  maxTitleChars: 200,
};

// --- Links ---------------------------------------------------------------------

/** Base58: no 0/O/I/l, so a link read aloud or retyped survives. */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
export const SLUG_LENGTH = 10;
const SLUG_RE = new RegExp(`^[${ALPHABET}]{${SLUG_LENGTH}}$`);

export function isSlug(v: unknown): v is string {
  return typeof v === "string" && SLUG_RE.test(v);
}

/** 10 base58 characters ≈ 58 bits: unguessable enough for an unlisted link. */
export function newSlug(random: (n: number) => Uint8Array = randomBytes): string {
  let out = "";
  while (out.length < SLUG_LENGTH) {
    for (const b of random(SLUG_LENGTH * 2)) {
      // 232 = 4 × 58: rejecting the rest keeps every character equally likely.
      if (b < 232 && out.length < SLUG_LENGTH) out += ALPHABET[b % 58];
    }
  }
  return out;
}

export function newDeleteToken(random: (n: number) => Uint8Array = randomBytes): string {
  return [...random(16)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isDeleteToken(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{32}$/.test(v);
}

function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// --- Publishing ----------------------------------------------------------------

const RUNNERS: readonly Runner[] = ["hosted", "byok", "webllm", "custom"];

export type ShareRequest = { experiment: Experiment; runner: Runner };

/**
 * What gets published from what's on screen: finished runs only (a run still
 * streaming, or never started, isn't a result), everything else as is.
 */
export function prepareForSharing(e: Experiment): Experiment {
  return { ...e, title: e.title.trim(), runs: e.runs.filter((r) => r.status === "done" || r.status === "error") };
}

export function validateShareRequest(body: unknown): { ok: true; request: ShareRequest } | { ok: false; message: string } {
  if (!body || typeof body !== "object") return { ok: false, message: "Body must be an object." };
  const { experiment, runner } = body as { experiment?: unknown; runner?: unknown };
  if (!RUNNERS.includes(runner as Runner)) return { ok: false, message: "Unknown runner." };
  const v = validateExperiment(experiment);
  if (!v.ok) return { ok: false, message: `This experiment can't be shared: ${v.reason}` };
  const e = prepareForSharing(v.experiment);
  if (!e.title) return { ok: false, message: "Give the experiment a title before sharing it." };
  if (e.title.length > SHARE_LIMITS.maxTitleChars) return { ok: false, message: "The title is too long to share." };
  if (!e.question.trim()) return { ok: false, message: "Write the question before sharing." };
  if (e.runs.length > SHARE_LIMITS.maxRuns) return { ok: false, message: "Too many runs to share." };
  if (e.lens !== undefined && !isLensId(e.lens)) return { ok: false, message: "Unknown lens." };
  return { ok: true, request: { experiment: e, runner: runner as Runner } };
}

// --- Reading -------------------------------------------------------------------

export type SharedExperiment = {
  slug: string;
  title: string;
  lens: LensId | null;
  experiment: Experiment;
  manifest: Manifest;
  manifestHash: string;
  createdAt: string;
};

export function shareUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}/e/${slug}`;
}

/**
 * A reader's own copy to rerun: the same design, no runs, the hypothesis open
 * again (it's their prediction now), and a pointer back to the original so
 * the two results can be compared.
 */
export function forkExperiment(shared: Pick<SharedExperiment, "slug" | "manifestHash" | "experiment">, now: number): Experiment {
  const e = shared.experiment;
  return {
    ...e,
    id: newId("exp"),
    title: e.title.endsWith("(rerun)") ? e.title : `${e.title} (rerun)`,
    hypothesisLockedAt: undefined,
    runs: [],
    forkedFrom: { slug: shared.slug, manifestHash: shared.manifestHash },
    createdAt: now,
    updatedAt: now,
  };
}
