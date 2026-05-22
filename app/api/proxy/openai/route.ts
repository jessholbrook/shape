/**
 * BYOK proxy for OpenAI.
 *
 * The browser sends the user's key in `x-shape-openai-key`. We forward to
 * OpenAI with that key and stream the response straight back. The key lives
 * in process memory only for the duration of the request and is never
 * logged, persisted, or echoed in the response.
 */

export const runtime = "edge";
export const dynamic = "force-dynamic";

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";

export async function POST(req: Request) {
  const key = req.headers.get("x-shape-openai-key");
  if (!key) {
    return new Response(
      JSON.stringify({ error: { message: "Missing x-shape-openai-key header." } }),
      { status: 400, headers: { "content-type": "application/json" } },
    );
  }

  const body = await req.text();

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
    return new Response(
      JSON.stringify({ error: { message: `Upstream fetch failed: ${message}` } }),
      { status: 502, headers: { "content-type": "application/json" } },
    );
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
