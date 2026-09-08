import type { ChatCall, ChatEvent, ChatMessage, ToolSpec } from "./types";
import { readSse } from "./sse";

/**
 * Shared adapter for OpenAI-compatible chat APIs (OpenAI itself, Cerebras, and
 * any drop-in `/chat/completions` endpoint). Callers supply the URL, the
 * header the key rides in, and a label for error messages.
 *
 * OpenAI and Cerebras are proxied through our own edge routes rather than
 * called directly: OpenAI blocks browser calls outright, and we default to
 * the same safe path for others whose CORS behavior we don't control. The
 * custom endpoint is the exception — it is called directly, with a bearer
 * key. The key is used for that one request in memory and never logged or
 * stored.
 */
export type OpenAiCompatConfig = {
  /** Where the request goes — one of our proxy routes, or a direct endpoint URL. */
  proxyUrl: string;
  keyHeader: string;
  /** Send the key as `Bearer <key>` (direct endpoints) rather than raw (our proxies). */
  bearer?: boolean;
  label: string;
};

function keyValue(cfg: OpenAiCompatConfig, apiKey: string): string {
  return cfg.bearer ? `Bearer ${apiKey}` : apiKey;
}

type OpenAiMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

/** OpenAI's shape: `tool_calls` on the assistant turn, `role: "tool"` results keyed by call id. */
export function toOpenAiMessages(system: string, messages: ChatMessage[]): OpenAiMessage[] {
  const out: OpenAiMessage[] = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of messages) {
    if (m.role === "tool") {
      out.push({ role: "tool", tool_call_id: m.toolCallId, content: m.content });
    } else if (m.role === "assistant" && m.toolCalls?.length) {
      out.push({
        role: "assistant",
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: "function",
          function: { name: c.name, arguments: c.args || "{}" },
        })),
      });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

function toOpenAiTools(tools: ToolSpec[]) {
  return tools.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));
}

export async function* openAiCompatibleChat(
  call: ChatCall,
  cfg: OpenAiCompatConfig,
): AsyncIterable<ChatEvent> {
  if (!call.apiKey) {
    throw new Error(`${cfg.label} provider requires an API key.`);
  }
  const res = await fetch(cfg.proxyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [cfg.keyHeader]: keyValue(cfg, call.apiKey),
    },
    body: JSON.stringify({
      model: call.model,
      messages: toOpenAiMessages(call.system, call.messages),
      temperature: call.temperature,
      max_tokens: call.maxTokens ?? 1024,
      stream: true,
      stream_options: { include_usage: true },
      ...(call.tools?.length ? { tools: toOpenAiTools(call.tools) } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`${cfg.label} ${res.status}: ${errText}`);
  }

  yield* parseOpenAiCompatibleStream(dataOf(readSse(res)));
}

async function* dataOf(events: AsyncIterable<{ data: string }>): AsyncIterable<string> {
  for await (const { data } of events) yield data;
}

/**
 * The stream, as events. Tool calls arrive fragmented: the first delta for
 * an index carries the id and name, later ones append argument text. A call
 * is yielded once the choice finishes (`finish_reason`) or the stream ends,
 * whichever comes first — some providers send the whole call in one chunk
 * and never send a finish reason before `[DONE]`.
 */
export async function* parseOpenAiCompatibleStream(
  datas: AsyncIterable<string>,
): AsyncIterable<ChatEvent> {
  let inputTokens = 0;
  let outputTokens = 0;
  const pending = new Map<number, { id: string; name: string; args: string }>();
  let flushed = false;

  function* flush(): Generator<ChatEvent> {
    if (flushed) return;
    flushed = true;
    const calls = [...pending.entries()].sort((a, b) => a[0] - b[0]);
    for (const [index, c] of calls) {
      yield {
        type: "tool_call",
        call: { id: c.id || `call_${index}`, name: c.name, args: c.args || "{}" },
      };
    }
    pending.clear();
  }

  for await (const data of datas) {
    if (data === "[DONE]") break;
    let parsed: OpenAiSseData;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const choice = parsed.choices?.[0];
    const delta = choice?.delta?.content;
    if (typeof delta === "string" && delta.length > 0) {
      yield { type: "text", delta };
    }
    for (const tc of choice?.delta?.tool_calls ?? []) {
      const index = typeof tc.index === "number" ? tc.index : 0;
      const p = pending.get(index) ?? { id: "", name: "", args: "" };
      if (tc.id) p.id = tc.id;
      if (tc.function?.name) p.name += tc.function.name;
      if (tc.function?.arguments) p.args += tc.function.arguments;
      pending.set(index, p);
      flushed = false;
    }
    if (choice?.finish_reason) {
      yield* flush();
    }
    if (parsed.usage) {
      inputTokens = parsed.usage.prompt_tokens ?? inputTokens;
      outputTokens = parsed.usage.completion_tokens ?? outputTokens;
    }
  }

  yield* flush();
  yield { type: "done", usage: { inputTokens, outputTokens } };
}

export async function pingOpenAiCompatible(
  apiKey: string,
  model: string,
  cfg: OpenAiCompatConfig,
): Promise<void> {
  const res = await fetch(cfg.proxyUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [cfg.keyHeader]: keyValue(cfg, apiKey),
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`${cfg.label} ${res.status}: ${errText}`);
  }
}

async function safeReadError(res: Response): Promise<string> {
  try {
    const body = await res.text();
    try {
      const json = JSON.parse(body);
      return json?.error?.message ?? json?.message ?? body.slice(0, 200);
    } catch {
      return body.slice(0, 200);
    }
  } catch {
    return res.statusText;
  }
}

type OpenAiSseData = {
  choices?: {
    delta?: {
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        function?: { name?: string; arguments?: string };
      }[];
    };
    finish_reason?: string | null;
  }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number };
};
