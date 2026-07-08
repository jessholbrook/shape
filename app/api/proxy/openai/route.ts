/**
 * BYOK proxy for OpenAI.
 *
 * The browser sends the user's key in `x-shape-openai-key`. We forward to
 * OpenAI with that key and stream the response straight back. The key lives
 * in process memory only for the duration of the request and is never
 * logged, persisted, or echoed in the response.
 *
 * Guarded so it can't be used as an open relay: same-origin only, per-IP
 * rate limited, and body-size capped.
 */

import {
  clientIp,
  forbidden,
  isSameOrigin,
  rateLimit,
  tooManyRequests,
} from "@/lib/api-guard";

export const runtime = "edge";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

// The inference path fires several calls per session (Diff runs 2, evals /
// refusal fan out, choreographer up to 10), so this is lenient — enough to
// stop someone scripting the endpoint as a relay, not enough to hit real use.
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000;

// Chat payloads carry system prompt + history; 256KB is generous for that and
// still rejects anyone trying to shove large bodies through the relay.
const MAX_BODY_BYTES = 256 * 1024;

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!isSameOrigin(req)) return forbidden();

  const gate = rateLimit(
    `openai:${clientIp(req)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
    Date.now(),
  );
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  const key = req.headers.get("x-shape-openai-key");
  if (!key) {
    return jsonError(400, "Missing x-shape-openai-key header.");
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
      },
      body,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonError(502, `Upstream fetch failed: ${message}`);
  }

  const contentType =
    upstream.headers.get("content-type") ?? "text/event-stream";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      "content-type": contentType,
      "cache-control": "no-store",
    },
  });
}
