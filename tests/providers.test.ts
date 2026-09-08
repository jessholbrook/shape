/**
 * Provider stream parsing, tool calls included.
 *
 * Each adapter exposes its parser as a pure generator over SSE payloads so
 * the tool-call assembly — which differs per provider and is where the bugs
 * live — can be tested without a network. OpenAI fragments a call across
 * chunks; Anthropic opens a block, streams JSON deltas, and closes it;
 * Gemini sends the call whole.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import { parseAnthropicStream, toAnthropicMessages } from "../lib/providers/anthropic";
import { parseOpenAiCompatibleStream, toOpenAiMessages } from "../lib/providers/openai-compatible";
import { parseGeminiStream, toContents } from "../lib/providers/gemini";
import { parseToolArgs, type ChatEvent, type ChatMessage } from "../lib/providers/types";

async function* from(items: unknown[]): AsyncIterable<string> {
  for (const i of items) yield typeof i === "string" ? i : JSON.stringify(i);
}

async function collect(events: AsyncIterable<ChatEvent>): Promise<ChatEvent[]> {
  const out: ChatEvent[] = [];
  for await (const e of events) out.push(e);
  return out;
}

const transcript: ChatMessage[] = [
  { role: "user", content: "Find my taxes" },
  { role: "assistant", content: "", toolCalls: [{ id: "c1", name: "search_files", args: '{"query":"taxes"}' }] },
  { role: "tool", toolCallId: "c1", name: "search_files", content: "3 files found" },
  { role: "assistant", content: "Found three." },
];

describe("anthropic", () => {
  test("a tool_use block streams its JSON and completes on stop", async () => {
    const events = await collect(parseAnthropicStream(from([
      { type: "message_start", message: { usage: { input_tokens: 10, output_tokens: 0 } } },
      { type: "content_block_start", index: 0, content_block: { type: "text" } },
      { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Let me look." } },
      { type: "content_block_stop", index: 0 },
      { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "toolu_1", name: "search_files", input: {} } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: '{"query": "tax' } },
      { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: ' documents"}' } },
      { type: "content_block_stop", index: 1 },
      { type: "message_delta", usage: { output_tokens: 25 } },
    ])));
    assert.deepEqual(events, [
      { type: "text", delta: "Let me look." },
      { type: "tool_call", call: { id: "toolu_1", name: "search_files", args: '{"query": "tax documents"}' } },
      { type: "done", usage: { inputTokens: 10, outputTokens: 25 } },
    ]);
  });

  test("a call with no arguments yields empty JSON, and a truncated stream still yields the call", async () => {
    const events = await collect(parseAnthropicStream(from([
      { type: "content_block_start", index: 0, content_block: { type: "tool_use", id: "t", name: "list_all" } },
    ])));
    assert.deepEqual(events[0], { type: "tool_call", call: { id: "t", name: "list_all", args: "{}" } });
  });

  test("messages: results ride the user turn and adjacent results merge", () => {
    const msgs = toAnthropicMessages([
      ...transcript.slice(0, 3),
      { role: "tool", toolCallId: "c2", name: "other", content: "ok" },
    ]);
    assert.equal(msgs[1].role, "assistant");
    assert.deepEqual(msgs[1].content, [{ type: "tool_use", id: "c1", name: "search_files", input: { query: "taxes" } }]);
    assert.equal(msgs[2].role, "user");
    assert.equal((msgs[2].content as unknown[]).length, 2);
  });
});

describe("openai-compatible", () => {
  test("a call fragmented across chunks is assembled and yielded on finish", async () => {
    const events = await collect(parseOpenAiCompatibleStream(from([
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "call_1", function: { name: "send_email", arguments: "" } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '{"to":' } }] } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"priya"}' } }] } }] },
      { choices: [{ delta: {}, finish_reason: "tool_calls" }] },
      { choices: [], usage: { prompt_tokens: 40, completion_tokens: 12 } },
      "[DONE]",
    ])));
    assert.deepEqual(events, [
      { type: "tool_call", call: { id: "call_1", name: "send_email", args: '{"to":"priya"}' } },
      { type: "done", usage: { inputTokens: 40, outputTokens: 12 } },
    ]);
  });

  test("a whole call in one chunk with no finish reason is flushed at the end, once", async () => {
    const events = await collect(parseOpenAiCompatibleStream(from([
      { choices: [{ delta: { content: "Sure." } }] },
      { choices: [{ delta: { tool_calls: [{ index: 0, id: "c", function: { name: "f", arguments: "{}" } }] } }] },
      "[DONE]",
    ])));
    assert.equal(events.filter((e) => e.type === "tool_call").length, 1);
    assert.equal(events[0].type, "text");
  });

  test("messages: tool_calls on the assistant, tool role keyed by call id", () => {
    const msgs = toOpenAiMessages("sys", transcript);
    assert.deepEqual(msgs[0], { role: "system", content: "sys" });
    assert.deepEqual(msgs[2], {
      role: "assistant", content: null,
      tool_calls: [{ id: "c1", type: "function", function: { name: "search_files", arguments: '{"query":"taxes"}' } }],
    });
    assert.deepEqual(msgs[3], { role: "tool", tool_call_id: "c1", content: "3 files found" });
  });
});

describe("gemini", () => {
  test("a functionCall part becomes a call with a minted id and JSON args", async () => {
    const events = await collect(parseGeminiStream(from([
      { candidates: [{ content: { parts: [{ text: "On it. " }, { functionCall: { name: "delete_files", args: { paths: "~/Downloads/*.png" } } }] } }] },
      { usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 9 } },
    ])));
    assert.deepEqual(events, [
      { type: "text", delta: "On it. " },
      { type: "tool_call", call: { id: "delete_files#1", name: "delete_files", args: '{"paths":"~/Downloads/*.png"}' } },
      { type: "done", usage: { inputTokens: 30, outputTokens: 9 } },
    ]);
  });

  test("contents: model turn carries functionCall, results ride a user turn as functionResponse", () => {
    const contents = toContents(transcript);
    assert.equal(contents[1].role, "model");
    assert.deepEqual(contents[1].parts, [{ functionCall: { name: "search_files", args: { query: "taxes" } } }]);
    assert.deepEqual(contents[2], { role: "user", parts: [{ functionResponse: { name: "search_files", response: { result: "3 files found" } } }] });
  });
});

describe("tool args", () => {
  test("empty, object, non-object, and malformed", () => {
    assert.deepEqual(parseToolArgs(""), {});
    assert.deepEqual(parseToolArgs('{"a":1}'), { a: 1 });
    assert.deepEqual(parseToolArgs("[1]"), { value: [1] });
    assert.deepEqual(parseToolArgs("{oops"), { raw: "{oops" });
  });
});
