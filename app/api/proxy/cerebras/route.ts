/**
 * BYOK proxy for Cerebras Inference (OpenAI-compatible).
 *
 * Mirrors the OpenAI proxy: the browser sends the user's key in
 * `x-shape-cerebras-key`, we forward it to Cerebras and stream the response
 * back. The key lives in process memory for the request only — never logged,
 * persisted, or echoed. Same-origin gated, per-IP rate limited, body-capped so
 * it can't be used as an open relay.
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

const CEREBRAS_URL = "https://api.cerebras.ai/v1/chat/completions";

const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60 * 1000;
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
    `cerebras:${clientIp(req)}`,
    RATE_LIMIT,
    RATE_WINDOW_MS,
    Date.now(),
  );
  if (!gate.ok) return tooManyRequests(gate.retryAfter);

  const key = req.headers.get("x-shape-cerebras-key");
  if (!key) {
    return jsonError(400, "Missing x-shape-cerebras-key header.");
  }

  const body = await req.text();
  if (body.length > MAX_BODY_BYTES) {
    return jsonError(413, "Request body too large.");
  }

  let upstream: Response;
  try {
    upstream = await fetch(CEREBRAS_URL, {
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
