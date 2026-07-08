/**
 * Lightweight abuse guards for the public edge routes (/api/feedback,
 * /api/proxy/openai). Two layers:
 *
 *   1. Same-origin check — the only legitimate callers are the app's own
 *      pages, which always send an Origin (or at least Referer) matching the
 *      host that served them. Cross-origin and header-less callers (naive
 *      curl/bots) are rejected. Not a hard security boundary — Origin can be
 *      spoofed — but it turns a wide-open endpoint into one you have to try to
 *      abuse.
 *
 *   2. Per-IP rate limit — a best-effort sliding window kept in module memory.
 *      Edge isolates don't share state, so this caps abuse per-instance rather
 *      than globally; it's a speed bump, not a quota. Swap the Map for Vercel
 *      KV / Upstash if you later need a durable global limit.
 */

/** Hosts allowed to call the API, beyond the request's own host. */
function allowedHosts(requestHost: string | null): Set<string> {
  const hosts = new Set<string>();
  if (requestHost) hosts.add(requestHost.toLowerCase());
  const site = process.env.NEXT_PUBLIC_SITE_URL;
  if (site) safeAddHost(hosts, site);
  if (process.env.VERCEL_URL) safeAddHost(hosts, `https://${process.env.VERCEL_URL}`);
  // Vercel preview/prod deployments and the apex domain.
  hosts.add("shape-models.com");
  hosts.add("www.shape-models.com");
  return hosts;
}

function safeAddHost(set: Set<string>, url: string) {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    set.add(u.host.toLowerCase());
  } catch {
    /* ignore malformed env */
  }
}

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

/**
 * True when the request looks like it came from one of the app's own pages.
 * Requires an Origin or Referer whose host is in the allow-list. A missing
 * *and* unmatchable header pair is treated as cross-origin (rejected).
 */
export function isSameOrigin(req: Request): boolean {
  const requestHost = req.headers.get("host");
  const allow = allowedHosts(requestHost);
  const originHost = hostOf(req.headers.get("origin"));
  if (originHost) return allow.has(originHost);
  // Some same-origin POSTs omit Origin; fall back to Referer.
  const refererHost = hostOf(req.headers.get("referer"));
  if (refererHost) return allow.has(refererHost);
  return false;
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

type Hit = { count: number; resetAt: number };
const buckets = new Map<string, Hit>();

/**
 * Best-effort fixed-window rate limit. Returns whether the call is allowed and,
 * when not, how many seconds until the window resets.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
  now: number,
): { ok: boolean; retryAfter: number } {
  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }
  if (existing.count >= limit) {
    return { ok: false, retryAfter: Math.ceil((existing.resetAt - now) / 1000) };
  }
  existing.count += 1;
  return { ok: true, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number): Response {
  return new Response(
    JSON.stringify({ error: { message: "Too many requests. Try again shortly." } }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
        "retry-after": String(Math.max(1, retryAfter)),
      },
    },
  );
}

export function forbidden(): Response {
  return new Response(
    JSON.stringify({ error: { message: "Forbidden." } }),
    { status: 403, headers: { "content-type": "application/json", "cache-control": "no-store" } },
  );
}
