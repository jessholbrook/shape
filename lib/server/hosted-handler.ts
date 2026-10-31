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
import { isToken, memberCookieName, promptFingerprint } from "../classroom";
import { sha256Hex } from "../sharing";
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

const MAX_RECORDED_CHARS = 40_000;

const CLASS_MESSAGE: Record<string, string> = {
  not_member: "Join the class before running its experiment.",
  closed: "This class is closed.",
  class_daily: "This class has used today's free runs. They reset at midnight UTC.",
  member_daily: "You've used your free runs in this class for today. They reset at midnight UTC.",
  monthly: QUOTA_MESSAGE.monthly,
};

function classRefusal(status: number, reason: string | undefined): Response {
  const r = reason && reason in CLASS_MESSAGE ? reason : "off";
  return json(status, { error: { message: CLASS_MESSAGE[r] ?? QUOTA_MESSAGE.off, reason: r } }, { "x-shape-quota-scope": "class" });
}

/** The user turn, as the run checker will rebuild it: the text of a single user message. */
function userText(r: HostedRequest): string {
  const text = (m: HostedRequest["messages"][number]) =>
    typeof m.content === "string" ? m.content : m.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return r.messages.length === 1 && r.messages[0].role === "user" ? text(r.messages[0]) : JSON.stringify(r.messages);
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

    const { day, month } = periodKeys(now());
    const reserve = reserveMicroUsd(request);
    let setCookie: Record<string, string> = {};
    let quota: { ok: boolean; remaining?: number; reason?: string };
    // Set for a call made inside a class: whose it is, and what it was asked.
    let classCtx: { classId: string; memberId: string; callId: string; promptHash: string } | null = null;

    if (v.classCall) {
      // A class call draws on the class's allowance, not this visitor's or
      // network's — but only for a member of that class, by their cookie.
      const token = readCookie(req, memberCookieName(v.classCall.code));
      if (!isToken(token, 16)) return classRefusal(403, "not_member");
      let r: { ok: boolean; reason?: string; remaining?: number; class_id?: string; member_id?: string };
      try {
        r = await deps.rpc("consume_class_quota", {
          p_code: v.classCall.code,
          p_member_hash: await sha256Hex(token),
          p_day: day,
          p_member_limit: config.classMemberDailyCalls,
          p_month: month,
          p_reserve_micro: reserve,
          p_cap_micro: config.monthlyCapMicro,
        });
      } catch (err) {
        console.error("hosted: class quota check failed", err instanceof Error ? err.message : err);
        return refusal(503, "off");
      }
      if (!r.ok || !r.class_id || !r.member_id) return classRefusal(r.reason === "closed" ? 409 : r.reason === "not_member" ? 403 : 429, r.reason);
      quota = { ok: true, remaining: r.remaining };
      classCtx = {
        classId: r.class_id,
        memberId: r.member_id,
        callId: v.classCall.callId,
        promptHash: await promptFingerprint({ system: request.system, user: userText(request), temperature: request.temperature }),
      };
    } else {
      const visitorId = visitor(req);
      setCookie = visitorId.setCookie;
      const who = await subjects(config.hashSecret, visitorId.id, ip, day);
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
    }

    const rpc = deps.rpc;
    const encoder = new TextEncoder();
    const body$ = new ReadableStream<Uint8Array>({
      async start(controller) {
        let inputTokens = 0;
        let outputTokens = 0;
        // A class call's answer, kept so a submitted run can be checked against it.
        let text = "";
        try {
          for await (const event of deps.stream({ apiKey: config.anthropicKey, request, signal: req.signal })) {
            if (event.type === "message_start") {
              const usage = (event.message as { usage?: { input_tokens?: number; output_tokens?: number } } | undefined)?.usage;
              inputTokens = usage?.input_tokens ?? inputTokens;
              outputTokens = usage?.output_tokens ?? outputTokens;
            } else if (event.type === "message_delta") {
              const usage = event.usage as { output_tokens?: number } | undefined;
              if (usage?.output_tokens != null) outputTokens = usage.output_tokens;
            } else if (classCtx && event.type === "content_block_delta") {
              const delta = event.delta as { type?: string; text?: string } | undefined;
              if (delta?.type === "text_delta" && typeof delta.text === "string" && text.length < MAX_RECORDED_CHARS) text += delta.text;
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
          if (classCtx) {
            try {
              await rpc("record_class_call", {
                p_class_id: classCtx.classId,
                p_member_id: classCtx.memberId,
                p_call_id: classCtx.callId,
                p_model: HOSTED_MODEL,
                p_prompt_hash: classCtx.promptHash,
                p_text: text.slice(0, MAX_RECORDED_CHARS),
                p_input: inputTokens,
                p_output: outputTokens,
              });
            } catch (err) {
              // The student still has their answer; the run will count as reported, not recorded.
              console.error("hosted: recording a class call failed", err instanceof Error ? err.message : err);
            }
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
        "x-shape-quota-limit": String(classCtx ? config.classMemberDailyCalls : config.dailyCalls),
        ...(classCtx ? { "x-shape-quota-scope": "class" } : {}),
        ...setCookie,
      },
    });
  };
}

// Once per instance: an intentionally-off tier shouldn't log on every page view.
let warnedOff = false;

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
      if (!config.enabled && !warnedOff) {
        warnedOff = true;
        console.warn(`hosted: free tier off — ${config.reason}`);
      }
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
