/**
 * Live model lists and the custom endpoint.
 *
 * The static catalog drifts; the API is the truth about what exists. These
 * cover the seams where the two disagree: an API model we have no rate card
 * for, a catalog model the API dropped, and the OpenAI list that includes
 * everything from embeddings to TTS.
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  chatCapable,
  isFresh,
  LIVE_TTL_MS,
  mergeModels,
  parseModelList,
} from "../lib/live-models";
import {
  customChatUrl,
  customModelsUrl,
  normalizeBaseUrl,
  validateBaseUrl,
  endpointLabel,
} from "../lib/custom-endpoint";
import { PROVIDERS } from "../lib/providers";

describe("model list parsing", () => {
  test("anthropic: data[].id with display names", () => {
    const list = parseModelList("anthropic", {
      data: [
        { id: "claude-sonnet-4-6", display_name: "Claude Sonnet 4.6" },
        { id: "claude-next", display_name: "Claude Next" },
      ],
    });
    assert.deepEqual(list.map((m) => m.id), ["claude-sonnet-4-6", "claude-next"]);
    assert.equal(list[1].name, "Claude Next");
    assert.equal(list[1].inputPer1M, undefined);
  });

  test("gemini: models/ prefix stripped, non-chat methods dropped", () => {
    const list = parseModelList("gemini", {
      models: [
        { name: "models/gemini-3.5-flash", displayName: "Gemini 3.5 Flash", supportedGenerationMethods: ["generateContent"] },
        { name: "models/embedding-001", displayName: "Embedding", supportedGenerationMethods: ["embedContent"] },
      ],
    });
    assert.deepEqual(list, [{ id: "gemini-3.5-flash", name: "Gemini 3.5 Flash" }]);
  });

  test("openai: only chat-capable ids survive the account-wide list", () => {
    const ids = ["gpt-4o", "gpt-4o-mini", "text-embedding-3-small", "tts-1", "whisper-1", "dall-e-3", "o3", "gpt-4o-realtime-preview", "gpt-3.5-turbo-instruct", "chatgpt-4o-latest"];
    const list = parseModelList("openai", { data: ids.map((id) => ({ id })) });
    assert.deepEqual(list.map((m) => m.id), ["gpt-4o", "gpt-4o-mini", "o3", "chatgpt-4o-latest"]);
    assert.equal(chatCapable("cerebras", "whisper-1"), true, "the filter is OpenAI-only");
  });

  test("openrouter pricing (per token, as strings) becomes per million", () => {
    const list = parseModelList("custom", {
      data: [{ id: "anthropic/claude-sonnet-4.6", name: "Anthropic: Claude Sonnet 4.6", pricing: { prompt: "0.000003", completion: "0.000015" } }],
    });
    assert.equal(list[0].inputPer1M, 3);
    assert.equal(list[0].outputPer1M, 15);
    assert.equal(list[0].name, "Anthropic: Claude Sonnet 4.6");
  });

  test("garbage in, empty list out", () => {
    assert.deepEqual(parseModelList("openai", null), []);
    assert.deepEqual(parseModelList("openai", { data: "nope" }), []);
    assert.deepEqual(parseModelList("gemini", { models: [{ name: 42 }] }), []);
  });
});

describe("merging live and static", () => {
  const anthropic = PROVIDERS.anthropic.models;

  test("no live list: the static catalog, untouched", () => {
    assert.deepEqual(mergeModels(anthropic, null), anthropic);
  });

  test("known models keep our names and order; unknown ones follow, pricing unknown", () => {
    const merged = mergeModels(anthropic, [
      { id: "claude-zeta" },
      { id: "claude-sonnet-4-6" },
      { id: "claude-alpha" },
      { id: "claude-opus-4-7" },
    ]);
    assert.deepEqual(merged.map((m) => m.id), ["claude-opus-4-7", "claude-sonnet-4-6", "claude-alpha", "claude-zeta"]);
    assert.equal(merged[0].name, "Claude Opus 4.7");
    assert.equal(merged[0].pricingUnknown, undefined);
    assert.equal(merged[2].pricingUnknown, true);
    assert.equal(merged[2].live, true);
    assert.equal(merged[0].live, undefined);
    assert.equal(merged[2].inputPer1M, 0);
  });

  test("a catalog model the API dropped disappears — unless it is the current selection", () => {
    const live = [{ id: "claude-sonnet-4-6" }];
    assert.deepEqual(mergeModels(anthropic, live).map((m) => m.id), ["claude-sonnet-4-6"]);
    const kept = mergeModels(anthropic, live, "claude-haiku-4-5");
    assert.deepEqual(kept.map((m) => m.id), ["claude-sonnet-4-6", "claude-haiku-4-5"]);
    assert.equal(kept[1].retired, true);
    assert.equal(kept[1].name, "Claude Haiku 4.5");
  });

  test("a selection nobody has ever heard of is kept too, flagged twice", () => {
    const kept = mergeModels(anthropic, [{ id: "claude-sonnet-4-6" }], "claude-from-a-draft");
    const last = kept[kept.length - 1];
    assert.equal(last.id, "claude-from-a-draft");
    assert.equal(last.retired, true);
    assert.equal(last.pricingUnknown, true);
  });

  test("a quoted price beats the hand-typed one", () => {
    const merged = mergeModels(anthropic, [{ id: "claude-sonnet-4-6", inputPer1M: 2, outputPer1M: 9 }]);
    assert.equal(merged[0].inputPer1M, 2);
    assert.equal(merged[0].outputPer1M, 9);
  });

  test("freshness is an hour", () => {
    const now = 1_000_000_000;
    const list = { provider: "openai" as const, models: [], fetchedAt: now - LIVE_TTL_MS + 1 };
    assert.equal(isFresh(list, now), true);
    assert.equal(isFresh({ ...list, fetchedAt: now - LIVE_TTL_MS }, now), false);
    assert.equal(isFresh(undefined, now), false);
  });
});

describe("custom endpoint", () => {
  test("base URLs are normalised: trailing slash, pasted chat or models paths", () => {
    assert.equal(normalizeBaseUrl(" https://openrouter.ai/api/v1/ "), "https://openrouter.ai/api/v1");
    assert.equal(normalizeBaseUrl("https://openrouter.ai/api/v1/chat/completions"), "https://openrouter.ai/api/v1");
    assert.equal(normalizeBaseUrl("http://localhost:1234/v1/models"), "http://localhost:1234/v1");
    assert.equal(customChatUrl("https://x.test/v1/"), "https://x.test/v1/chat/completions");
    assert.equal(customModelsUrl("https://x.test/v1"), "https://x.test/v1/models");
  });

  test("https anywhere; plain http only for localhost, where the key can't leak", () => {
    assert.equal(validateBaseUrl("https://openrouter.ai/api/v1").ok, true);
    assert.equal(validateBaseUrl("http://localhost:1234/v1").ok, true);
    assert.equal(validateBaseUrl("http://127.0.0.1:11434/v1").ok, true);
    assert.equal(validateBaseUrl("http://example.com/v1").ok, false);
    assert.equal(validateBaseUrl("ftp://example.com").ok, false);
    assert.equal(validateBaseUrl("not a url").ok, false);
    assert.equal(validateBaseUrl("").ok, false);
  });

  test("the label is the host", () => {
    assert.equal(endpointLabel("https://openrouter.ai/api/v1"), "openrouter.ai");
    assert.equal(endpointLabel("http://localhost:1234/v1"), "localhost:1234");
    assert.equal(endpointLabel("garbage"), "garbage");
  });
});
