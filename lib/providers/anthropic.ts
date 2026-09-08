import type { ChatCall, ChatEvent, ChatMessage, ToolSpec } from "./types";
import { parseToolArgs } from "./types";
import { readSse } from "./sse";

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string };

type AnthropicMessage = { role: "user" | "assistant"; content: string | Block[] };

/**
 * Anthropic's shape: tool calls are `tool_use` blocks on the assistant turn,
 * and results are `tool_result` blocks on the *user* turn. Consecutive tool
 * results have to share one user message, so adjacent ones are merged.
 */
export function toAnthropicMessages(messages: ChatMessage[]): AnthropicMessage[] {
  const out: AnthropicMessage[] = [];
  for (const m of messages) {
    if (m.role === "tool") {
      const block: Block = { type: "tool_result", tool_use_id: m.toolCallId, content: m.content };
      const last = out[out.length - 1];
      if (last && last.role === "user" && Array.isArray(last.content)) {
        last.content.push(block);
      } else {
        out.push({ role: "user", content: [block] });
      }
      continue;
    }
    if (m.role === "assistant" && m.toolCalls?.length) {
      const blocks: Block[] = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      for (const c of m.toolCalls) {
        blocks.push({ type: "tool_use", id: c.id, name: c.name, input: parseToolArgs(c.args) });
      }
      out.push({ role: "assistant", content: blocks });
      continue;
    }
    out.push({ role: m.role, content: m.content });
  }
  return out;
}

function toAnthropicTools(tools: ToolSpec[]) {
  return tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));
}

export async function* anthropicChat(call: ChatCall): AsyncIterable<ChatEvent> {
  if (!call.apiKey) {
    throw new Error("Anthropic provider requires an API key.");
  }
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": call.apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: call.model,
      max_tokens: call.maxTokens ?? 1024,
      system: call.system || undefined,
      messages: toAnthropicMessages(call.messages),
      temperature: call.temperature,
      stream: true,
      ...(call.tools?.length ? { tools: toAnthropicTools(call.tools) } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Anthropic ${res.status}: ${errText}`);
  }

  yield* parseAnthropicStream(dataOf(readSse(res)));
}

async function* dataOf(events: AsyncIterable<{ data: string }>): AsyncIterable<string> {
  for await (const { data } of events) yield data;
}

/**
 * The stream, as events. Text arrives as `text_delta`s; a tool call opens
 * with a `content_block_start` carrying its id and name, streams its
 * arguments as `input_json_delta` fragments, and closes with
 * `content_block_stop` — which is when the call is complete and yielded.
 */
export async function* parseAnthropicStream(
  datas: AsyncIterable<string>,
): AsyncIterable<ChatEvent> {
  let inputTokens = 0;
  let outputTokens = 0;
  const pending = new Map<number, { id: string; name: string; json: string }>();

  for await (const data of datas) {
    let parsed: AnthropicSseData;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }

    if (parsed.type === "message_start") {
      inputTokens = parsed.message?.usage?.input_tokens ?? inputTokens;
      outputTokens = parsed.message?.usage?.output_tokens ?? outputTokens;
    } else if (parsed.type === "content_block_start") {
      const block = parsed.content_block;
      if (block?.type === "tool_use" && typeof parsed.index === "number") {
        pending.set(parsed.index, {
          id: block.id ?? `call_${parsed.index}`,
          name: block.name ?? "",
          json: "",
        });
      }
    } else if (parsed.type === "content_block_delta") {
      const delta = parsed.delta;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        yield { type: "text", delta: delta.text };
      } else if (
        delta?.type === "input_json_delta" &&
        typeof delta.partial_json === "string" &&
        typeof parsed.index === "number"
      ) {
        const p = pending.get(parsed.index);
        if (p) p.json += delta.partial_json;
      }
    } else if (parsed.type === "content_block_stop") {
      if (typeof parsed.index === "number") {
        const p = pending.get(parsed.index);
        if (p) {
          pending.delete(parsed.index);
          yield { type: "tool_call", call: { id: p.id, name: p.name, args: p.json || "{}" } };
        }
      }
    } else if (parsed.type === "message_delta") {
      if (parsed.usage?.output_tokens != null) {
        outputTokens = parsed.usage.output_tokens;
      }
    }
  }

  // A stream that ended mid-block still made the call.
  for (const [, p] of pending) {
    yield { type: "tool_call", call: { id: p.id, name: p.name, args: p.json || "{}" } };
  }

  yield { type: "done", usage: { inputTokens, outputTokens } };
}

export async function pingAnthropic(
  apiKey: string,
  model: string,
): Promise<void> {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": API_VERSION,
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model,
      max_tokens: 1,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
  if (!res.ok) {
    const errText = await safeReadError(res);
    throw new Error(`Anthropic ${res.status}: ${errText}`);
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

type AnthropicSseData = {
  type: string;
  index?: number;
  message?: {
    usage?: { input_tokens?: number; output_tokens?: number };
  };
  content_block?: { type?: string; id?: string; name?: string };
  delta?: { type?: string; text?: string; partial_json?: string };
  usage?: { output_tokens?: number };
};
