/**
 * Visitor demo endpoint. Streams a single-turn Anthropic response using a
 * pooled server key, rate-limited per IP and per (IP, artifact).
 *
 * Required env:
 *   DEMO_ANTHROPIC_KEY   — pooled Anthropic API key
 *   DEMO_IP_SALT         — secret used to hash the client IP
 *   NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — for the artifacts
 *                          lookup and demo_turns counter
 *
 * Optional env:
 *   DEMO_TURNS_PER_ARTIFACT_PER_DAY   — default 5
 *   DEMO_TURNS_PER_IP_PER_DAY         — default 50
 *
 * Without DEMO_ANTHROPIC_KEY or Supabase env, returns 503. The "Try it" UI
 * detects that and renders a "Demo not configured" placeholder.
 */

import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";
import {
  DEMO_DEFAULT_TURNS_PER_ARTIFACT_PER_DAY,
  DEMO_DEFAULT_TURNS_PER_IP_PER_DAY,
  DEMO_MAX_TOKENS,
  DEMO_MODEL,
  getDemoSystem,
} from "@/lib/demo";
import type { Artifact } from "@/lib/artifacts";

export const runtime = "edge";
export const dynamic = "force-dynamic";

type DemoRequest = {
  handle: string;
  slug: string;
  userMessage: string;
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(req: Request) {
  if (!supabaseConfigured()) {
    return jsonError(503, "Demo backend is not configured.");
  }
  const demoKey = process.env.DEMO_ANTHROPIC_KEY;
  const ipSalt = process.env.DEMO_IP_SALT;
  if (!demoKey || !ipSalt) {
    return jsonError(503, "Demo backend is not configured.");
  }

  let body: DemoRequest;
  try {
    body = (await req.json()) as DemoRequest;
  } catch {
    return jsonError(400, "Invalid JSON body.");
  }
  const handle = typeof body.handle === "string" ? body.handle.trim() : "";
  const slug = typeof body.slug === "string" ? body.slug.trim() : "";
  const userMessage =
    typeof body.userMessage === "string" ? body.userMessage.trim() : "";
  if (!handle || !slug || !userMessage) {
    return jsonError(400, "Missing handle, slug, or userMessage.");
  }
  if (userMessage.length > 2000) {
    return jsonError(400, "Demo messages are capped at 2000 characters.");
  }

  const sb = getSupabase();
  if (!sb) return jsonError(503, "Supabase client unavailable.");

  const { data: artifactRow, error: artifactErr } = await sb
    .from("artifacts")
    .select("*")
    .eq("handle", handle)
    .eq("slug", slug)
    .maybeSingle();
  if (artifactErr) return jsonError(500, `Lookup failed: ${artifactErr.message}`);
  if (!artifactRow) return jsonError(404, "Artifact not found.");
  if ((artifactRow as { visibility: string }).visibility !== "public") {
    return jsonError(403, "Demo is only available for public artifacts.");
  }

  const artifact = artifactRow as unknown as Artifact & { id: string };
  const system = getDemoSystem(artifact.draft);
  if (!system) {
    return jsonError(
      400,
      "This artifact kind doesn't expose a single configuration to demo.",
    );
  }

  const ipHash = await hashIp(req, ipSalt);
  const turnsPerArtifact = parseInt(
    process.env.DEMO_TURNS_PER_ARTIFACT_PER_DAY ?? "",
    10,
  ) || DEMO_DEFAULT_TURNS_PER_ARTIFACT_PER_DAY;
  const turnsPerIp = parseInt(
    process.env.DEMO_TURNS_PER_IP_PER_DAY ?? "",
    10,
  ) || DEMO_DEFAULT_TURNS_PER_IP_PER_DAY;
  const dayCutoff = new Date(Date.now() - DAY_MS).toISOString();

  // Artifact-scoped count.
  const { count: artifactCount, error: aCountErr } = await sb
    .from("demo_turns")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .eq("artifact_id", artifact.id)
    .gte("created_at", dayCutoff);
  if (aCountErr) return jsonError(500, `Rate-limit lookup failed: ${aCountErr.message}`);
  const artifactUsed = artifactCount ?? 0;
  if (artifactUsed >= turnsPerArtifact) {
    return jsonError(
      429,
      `Demo limit reached for this artifact today (${turnsPerArtifact}/day). Bring your own key to keep going.`,
    );
  }

  // Site-wide IP count.
  const { count: ipCount, error: iCountErr } = await sb
    .from("demo_turns")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("created_at", dayCutoff);
  if (iCountErr) return jsonError(500, `Rate-limit lookup failed: ${iCountErr.message}`);
  const ipUsed = ipCount ?? 0;
  if (ipUsed >= turnsPerIp) {
    return jsonError(
      429,
      `You've hit today's demo limit across Shape (${turnsPerIp}/day). Bring your own key to keep going.`,
    );
  }

  // Record the turn before streaming. If the model errors mid-stream we've
  // still counted it — better than under-counting and letting visitors bypass
  // the cap by aborting mid-response.
  const { error: insertErr } = await sb.from("demo_turns").insert({
    ip_hash: ipHash,
    artifact_id: artifact.id,
  });
  if (insertErr) return jsonError(500, `Counter write failed: ${insertErr.message}`);

  const remainingArtifact = turnsPerArtifact - artifactUsed - 1;
  const remainingIp = turnsPerIp - ipUsed - 1;

  // Stream Anthropic response back to the client.
  const upstream = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": demoKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: DEMO_MODEL,
      max_tokens: DEMO_MAX_TOKENS,
      system,
      messages: [{ role: "user", content: userMessage }],
      stream: true,
    }),
  });

  if (!upstream.ok || !upstream.body) {
    const errText = await safeReadError(upstream);
    return jsonError(502, `Upstream model call failed: ${errText}`);
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-store",
      "x-shape-demo-remaining-artifact": String(remainingArtifact),
      "x-shape-demo-remaining-ip": String(remainingIp),
      "x-shape-demo-model": DEMO_MODEL,
    },
  });
}

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const text = await res.text();
    try {
      const json = JSON.parse(text);
      return json?.error?.message ?? text.slice(0, 200);
    } catch {
      return text.slice(0, 200);
    }
  } catch {
    return res.statusText;
  }
}

async function hashIp(req: Request, salt: string): Promise<string> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown";
  const bytes = new TextEncoder().encode(`${salt}:${ip}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
