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

// Node.js runtime (not edge) on purpose: Vercel's Edge runs on Cloudflare's
// network, and Cerebras is Cloudflare-fronted, so edge subrequests get a 403
// WAF block page. Node serverless egresses from different (AWS) IPs that clear
// it. Streaming the upstream body back still works on this runtime.
export const runtime = "nodejs";
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
        // Cerebras sits behind a Cloudflare WAF that 403s server-to-server
        // requests with no/suspicious User-Agent (returning an HTML block
        // page, not JSON). Send a real UA + Accept so the call gets through.
        "user-agent":
          "Mozilla/5.0 (compatible; ShapeModels/1.0; +https://shape-models.com)",
        accept: "application/json, text/event-stream",
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
