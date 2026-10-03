/**
 * Shape's hosted free tier: Claude Haiku 4.5 on Shape's own key, so a visitor
 * can run every playground and the lab without bringing one.
 *
 * Pure policy — no I/O. The route (app/api/hosted/anthropic) does the
 * network work; everything that decides *whether* and *how much* lives here
 * so it can be tested without a server, a database, or a key.
 *
 * The browser never chooses the model, the token ceiling, or anything else
 * that costs money: the server rebuilds the request from a validated subset.
 */

export const HOSTED_MODEL = "claude-haiku-4-5";

/** Claude Haiku 4.5, USD per million tokens. */
const INPUT_PER_1M = 1;
const OUTPUT_PER_1M = 5;

export const LIMITS = {
  maxBodyBytes: 64 * 1024,
  maxSystemChars: 20_000,
  maxMessages: 40,
  maxMessageChars: 20_000,
  maxTools: 8,
  /** Ceiling on output per call. Playgrounds ask for less; nobody gets more. */
  maxTokens: 1024,
  defaultMaxTokens: 1024,
} as const;

// --- Config -----------------------------------------------------------------------

export type HostedConfig =
  | {
      enabled: true;
      anthropicKey: string;
      supabaseUrl: string;
      supabaseKey: string;
      hashSecret: string;
      dailyCalls: number;
      networkCalls: number;
      monthlyCapMicro: number;
    }
  | { enabled: false; reason: string };

type Env = Record<string, string | undefined>;

function positiveNumber(v: string | undefined, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Read the free tier's settings. Off unless SHAPE_FREE_TIER is "on" (any case)
 * and every secret is present — a half-configured deploy is a disabled one,
 * never a broken one. The monthly cap has no default: spending money needs a
 * number someone chose.
 */
export function readHostedConfig(env: Env): HostedConfig {
  if (env.SHAPE_FREE_TIER?.trim().toLowerCase() !== "on") return { enabled: false, reason: "switched off (SHAPE_FREE_TIER is not \"on\")" };
  const missing = [
    "HOSTED_ANTHROPIC_API_KEY",
    "SUPABASE_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "QUOTA_HASH_SECRET",
    "HOSTED_MONTHLY_CAP_USD",
  ].filter((k) => !env[k]?.trim());
  if (missing.length) return { enabled: false, reason: `missing ${missing.join(", ")}` };
  // Forgive "$20" and "1,000": the dashboard is where this gets typed.
  const cap = Number(env.HOSTED_MONTHLY_CAP_USD!.replace(/[$,\s]/g, ""));
  if (!Number.isFinite(cap) || cap <= 0) return { enabled: false, reason: "HOSTED_MONTHLY_CAP_USD is not a positive number" };
  return {
    enabled: true,
    anthropicKey: env.HOSTED_ANTHROPIC_API_KEY!.trim(),
    supabaseUrl: env.SUPABASE_URL!.trim().replace(/\/$/, ""),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    hashSecret: env.QUOTA_HASH_SECRET!.trim(),
    dailyCalls: Math.floor(positiveNumber(env.HOSTED_DAILY_CALLS, 50)),
    // A classroom shares one network; this is a backstop against scripting,
    // not a per-room allowance.
    networkCalls: Math.floor(positiveNumber(env.HOSTED_NETWORK_DAILY_CALLS, 1500)),
    monthlyCapMicro: Math.round(cap * 1_000_000),
  };
}

// --- Request ----------------------------------------------------------------------

type TextBlock = { type: "text"; text: string };
type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: Record<string, unknown> };
type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string };
export type HostedBlock = TextBlock | ToolUseBlock | ToolResultBlock;
export type HostedMessage = { role: "user" | "assistant"; content: string | HostedBlock[] };
export type HostedTool = { name: string; description: string; input_schema: Record<string, unknown> };

/** The only fields that reach Anthropic. Everything else in the body is ignored. */
export type HostedRequest = {
  system: string;
  messages: HostedMessage[];
  temperature: number;
  maxTokens: number;
  tools: HostedTool[];
};

export type Validated = { ok: true; request: HostedRequest } | { ok: false; status: number; message: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const bad = (message: string): Validated => ({ ok: false, status: 400, message });

function blockChars(b: HostedBlock): number {
  if (b.type === "text") return b.text.length;
  if (b.type === "tool_result") return b.content.length;
  return JSON.stringify(b.input).length;
}

function validBlock(b: unknown): b is HostedBlock {
  if (!isObj(b)) return false;
  if (b.type === "text") return typeof b.text === "string";
  if (b.type === "tool_use") return typeof b.id === "string" && typeof b.name === "string" && isObj(b.input);
  if (b.type === "tool_result") return typeof b.tool_use_id === "string" && typeof b.content === "string";
  return false;
}

export function validateHostedRequest(body: unknown): Validated {
  if (!isObj(body)) return bad("Body must be a JSON object.");

  const system = body.system ?? "";
  if (typeof system !== "string" || system.length > LIMITS.maxSystemChars) {
    return bad(`System prompt must be text under ${LIMITS.maxSystemChars} characters.`);
  }

  const messages = body.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.maxMessages) {
    return bad(`Send between 1 and ${LIMITS.maxMessages} messages.`);
  }
  for (const m of messages) {
    if (!isObj(m) || (m.role !== "user" && m.role !== "assistant")) return bad("Each message needs a user or assistant role.");
    if (typeof m.content === "string") {
      if (m.content.length > LIMITS.maxMessageChars) return bad("A message is too long.");
    } else if (Array.isArray(m.content) && m.content.every(validBlock)) {
      if ((m.content as HostedBlock[]).reduce((n, b) => n + blockChars(b), 0) > LIMITS.maxMessageChars) {
        return bad("A message is too long.");
      }
    } else {
      return bad("Message content must be text or content blocks.");
    }
  }
  if ((messages[0] as { role: string }).role !== "user") return bad("The first message must be from the user.");

  const temperature = body.temperature ?? 1;
  if (typeof temperature !== "number" || !(temperature >= 0 && temperature <= 1)) {
    return bad("Temperature must be between 0 and 1.");
  }

  const requested = body.maxTokens ?? LIMITS.defaultMaxTokens;
  if (typeof requested !== "number" || !(requested >= 1)) return bad("maxTokens must be a positive number.");
  const maxTokens = Math.min(Math.floor(requested), LIMITS.maxTokens);

  const tools = body.tools ?? [];
  if (!Array.isArray(tools) || tools.length > LIMITS.maxTools) return bad(`At most ${LIMITS.maxTools} tools.`);
  for (const t of tools) {
    if (!isObj(t) || typeof t.name !== "string" || typeof t.description !== "string" || !isObj(t.input_schema)) {
      return bad("Each tool needs a name, description and input_schema.");
    }
  }

  return {
    ok: true,
    request: {
      system,
      messages: messages as HostedMessage[],
      temperature,
      maxTokens,
      tools: (tools as HostedTool[]).map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema })),
    },
  };
}

// --- Cost -------------------------------------------------------------------------

/** Rough token estimate for reservations — deliberately generous. */
function estimateTokens(chars: number): number {
  return Math.ceil(chars / 3);
}

export function requestChars(r: HostedRequest): number {
  const messages = r.messages.reduce(
    (n, m) => n + (typeof m.content === "string" ? m.content.length : m.content.reduce((k, b) => k + blockChars(b), 0)),
    0,
  );
  const tools = r.tools.reduce((n, t) => n + JSON.stringify(t).length, 0);
  return r.system.length + messages + tools;
}

/**
 * Worst-case cost of a call, reserved against the month before it runs:
 * a high estimate of the input plus every output token it's allowed.
 * Overestimating is the point — the settle step refunds the difference.
 */
export function reserveMicroUsd(r: HostedRequest): number {
  // Anthropic bills a fixed overhead on top of the text (role markers,
  // tool-use framing), which dominates short prompts.
  const input = estimateTokens(requestChars(r)) + 300;
  return Math.ceil(input * INPUT_PER_1M + r.maxTokens * OUTPUT_PER_1M);
}

/** What the call actually cost, from the usage Anthropic reported. */
export function actualMicroUsd(usage: { inputTokens: number; outputTokens: number }): number {
  return Math.ceil(usage.inputTokens * INPUT_PER_1M + usage.outputTokens * OUTPUT_PER_1M);
}

// --- Dates ------------------------------------------------------------------------

/** UTC day and month keys. Quotas reset at midnight UTC. */
export function periodKeys(now: Date): { day: string; month: string; resetsAt: string } {
  const day = now.toISOString().slice(0, 10);
  const month = `${day.slice(0, 7)}-01`;
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  return { day, month, resetsAt: next.toISOString() };
}

// --- Messages for people ------------------------------------------------------------

export type QuotaReason = "daily" | "network" | "monthly" | "off";

/** What the reader sees when the free tier says no — always with a way forward. */
export const QUOTA_MESSAGE: Record<QuotaReason, string> = {
  daily: "You've used today's free runs. They reset at midnight UTC — or add your own key in Settings to keep going.",
  network: "Your network has used today's free runs (common in classrooms). Add your own key in Settings, or use the in-browser model.",
  monthly: "The free tier has reached its budget for this month. Add your own key in Settings, or use the in-browser model.",
  off: "The free tier isn't available right now. Add your own key in Settings, or use the in-browser model.",
};
