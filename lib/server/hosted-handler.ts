import { clientIp, forbidden, isSameOrigin, rateLimit, tooManyRequests } from "../api-guard";
import {
  HOSTED_MODEL,
  LIMITS,
  QUOTA_MESSAGE,
  actualMicroUsd,
  periodKeys,
  reserveMicroUsd,
  validateHostedRequest,
  type HostedConfig,
  type HostedRequest,
  type QuotaReason,
} from "../hosted";
import { isVisitorId, newVisitorId, readCookie, subjects, visitorCookie, VISITOR_COOKIE } from "./identity";
import type { Rpc } from "./supabase";

/**
 * The free tier's request path, with its I/O passed in so tests can run it
 * against fakes. app/api/hosted/* wires in the real Supabase client and the
 * Anthropic SDK.
 *
 * Fails closed: if the quota database can't be reached, the call is refused
 * rather than served uncounted. Prompts and outputs are never logged.
 */

/** Anthropic's raw stream events, as the SDK yields them. Only `type` and usage are read here. */
export type StreamEvent = { type: string } & Record<string, unknown>;

export type Streamer = (args: { apiKey: string; request: HostedRequest; signal: AbortSignal }) => AsyncIterable<StreamEvent>;

export type HostedDeps = {
  config: HostedConfig;
  rpc: Rpc | null;
  stream: Streamer;
  now?: () => Date;
};

/**
 * Per-instance speed bump. The lab runs four calls at a time, so a single
 * experiment can make ~100 calls a minute; the daily quota and the monthly
 * cap are the real limits, this only slows a script down.
 */
const BURST_LIMIT = 120;
const BURST_WINDOW_MS = 60 * 1000;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

function refusal(status: number, reason: QuotaReason, headers: Record<string, string> = {}): Response {
  return json(status, { error: { message: QUOTA_MESSAGE[reason], reason } }, headers);
}

/** Visitor id from the cookie, or a new one plus the header that sets it. */
function visitor(req: Request): { id: string; setCookie: Record<string, string> } {
  const existing = readCookie(req, VISITOR_COOKIE);
  if (isVisitorId(existing)) return { id: existing, setCookie: {} };
  const id = newVisitorId();
  const secure = new URL(req.url).protocol === "https:";
  return { id, setCookie: { "set-cookie": visitorCookie(id, secure) } };
}

function sse(event: StreamEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

export function createHostedHandler(deps: HostedDeps) {
  const now = deps.now ?? (() => new Date());

  return async function POST(req: Request): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return refusal(503, "off");
    if (!isSameOrigin(req)) return forbidden();

    const ip = clientIp(req);
    const gate = rateLimit(`hosted:${ip}`, BURST_LIMIT, BURST_WINDOW_MS, now().getTime());
    if (!gate.ok) return tooManyRequests(gate.retryAfter);

    const raw = await req.text();
    if (raw.length > LIMITS.maxBodyBytes) return json(413, { error: { message: "Request too large for the free tier." } });
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { error: { message: "Body must be JSON." } });
    }
    const v = validateHostedRequest(body);
    if (!v.ok) return json(v.status, { error: { message: v.message } });
    const request = v.request;

    const { id, setCookie } = visitor(req);
    const { day, month } = periodKeys(now());
    const who = await subjects(config.hashSecret, id, ip, day);
    const reserve = reserveMicroUsd(request);

    let quota: { ok: boolean; remaining?: number; reason?: string };
    try {
      quota = await deps.rpc("consume_quota", {
        p_visitor: who.visitor,
        p_network: who.network,
        p_day: day,
        p_visitor_limit: config.dailyCalls,
        p_network_limit: config.networkCalls,
        p_month: month,
        p_reserve_micro: reserve,
        p_cap_micro: config.monthlyCapMicro,
      });
    } catch (err) {
      console.error("hosted: quota check failed", err instanceof Error ? err.message : err);
      return refusal(503, "off", setCookie);
    }
    if (!quota.ok) {
      const reason: QuotaReason = quota.reason === "daily" || quota.reason === "network" || quota.reason === "monthly" ? quota.reason : "off";
      return refusal(429, reason, { ...setCookie, "x-shape-quota-remaining": "0", "x-shape-quota-limit": String(config.dailyCalls) });
    }

    const rpc = deps.rpc;
    const encoder = new TextEncoder();
    const body$ = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        try {
          for await (const event of deps.stream({ apiKey: config.anthropicKey, request, signal: req.signal })) {
            if (event.type === "message_start") {
              const usage = (event.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
              inputTokens = usage?.input_tokens ?? inputTokens;
              outputTokens = usage?.output_tokens ?? outputTokens;
            } else if (event.type === "message_delta") {
              const usage = event.usage as { output_tokens?: number } | undefined;
              if (usage?.output_tokens != null) outputTokens = usage.output_tokens;
            }
            controller.enqueue(encoder.encode(sse(event)));
          }
        } catch (err) {
          // The client sees why; the logs see only that it happened.
          const message = err instanceof Error ? err.message : "The model call failed.";
          console.error("hosted: upstream failed");
          controller.enqueue(encoder.encode(sse({ type: "error", error: { type: "upstream_error", message } })));
        } finally {
          // Settle before closing: a serverless function can be frozen the
          // moment the response ends, and an unsettled reservation would hold
          // the month's budget hostage.
          try {
            await rpc("settle_spend", {
              p_month: month,
              p_reserved_micro: reserve,
              p_actual_micro: actualMicroUsd({ inputTokens, outputTokens }),
            });
          } catch (err) {
            console.error("hosted: settle failed", err instanceof Error ? err.message : err);
          }
          controller.close();
        }
      },
    });

    return new Response(body$, {
      status: 200,
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-store",
        "x-shape-model": HOSTED_MODEL,
        "x-shape-quota-remaining": String(quota.remaining ?? 0),
        "x-shape-quota-limit": String(config.dailyCalls),
        ...setCookie,
      },
    });
  };
}

export type HostedStatus = { enabled: boolean; limit: number; remaining: number; resetsAt: string; model: string };

/** GET /api/hosted/status — whether the free tier is usable right now, and how much of today is left. */
export function createStatusHandler(deps: Omit<HostedDeps, "stream">) {
  const now = deps.now ?? (() => new Date());
  return async function GET(req: Request): Promise<Response> {
    const { day, month, resetsAt } = periodKeys(now());
    const off: HostedStatus = { enabled: false, limit: 0, remaining: 0, resetsAt, model: HOSTED_MODEL };
    const config = deps.config;
    if (!config.enabled || !deps.rpc) {
      // Names only, never values: says which setting to fix.
      if (!config.enabled) console.warn(`hosted: free tier off — ${config.reason}`);
      return json(200, off);
    }

    const { id, setCookie } = visitor(req);
    const who = await subjects(config.hashSecret, id, clientIp(req), day);
    try {
      const s = await deps.rpc<{ used: number; month_open: boolean }>("quota_status", {
        p_visitor: who.visitor,
        p_day: day,
        p_month: month,
        // One worst-case call: is there room for at least that?
        p_reserve_micro: LIMITS.maxTokens * 5,
        p_cap_micro: config.monthlyCapMicro,
      });
      const remaining = Math.max(0, config.dailyCalls - (s.used ?? 0));
      const status: HostedStatus = {
        enabled: !!s.month_open,
        limit: config.dailyCalls,
        remaining,
        resetsAt,
        model: HOSTED_MODEL,
      };
      return json(200, status, setCookie);
    } catch (err) {
      // A paused or unreachable database means no free tier — not a broken page.
      console.error("hosted: status check failed", err instanceof Error ? err.message : err);
      return json(200, off, setCookie);
    }
  };
}
