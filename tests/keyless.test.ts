import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { preferredProvider, providerNeedsKey } from "../lib/providers";
import { authHeaders, type OpenAiCompatConfig } from "../lib/providers/openai-compatible";
import { normalizeBaseUrl, validateBaseUrl } from "../lib/custom-endpoint";

/**
 * A local LM Studio or Ollama wants no key. The gate every playground uses,
 * the default-provider choice, and the adapter's header all have to agree on
 * that, and a keyed endpoint has to behave exactly as before.
 */
describe("keyless local endpoints", () => {
  const keyless = { baseUrl: "http://localhost:11434/v1", keyless: true };
  const keyed = { baseUrl: "https://openrouter.ai/api/v1", keyless: false };

  test("the custom provider needs a key unless the endpoint says otherwise; nothing else changes", () => {
    assert.equal(providerNeedsKey("custom", keyless), false);
    assert.equal(providerNeedsKey("custom", keyed), true);
    assert.equal(providerNeedsKey("custom", null), true);
    assert.equal(providerNeedsKey("anthropic", keyless), true);
    assert.equal(providerNeedsKey("webllm", null), false);
  });

  test("a keyless endpoint is the default when no key is saved, and never beats a saved key", () => {
    assert.equal(preferredProvider({}, keyless), "custom");
    assert.equal(preferredProvider({}, keyed), "webllm");
    assert.equal(preferredProvider({}, null), "webllm");
    assert.equal(preferredProvider({ anthropic: "sk-ant-x" }, keyless), "anthropic");
  });

  test("the adapter sends no Authorization header for a key-optional endpoint with no key, and still refuses elsewhere", () => {
    const custom: OpenAiCompatConfig = { proxyUrl: "x", keyHeader: "authorization", bearer: true, keyOptional: true, label: "Custom endpoint" };
    const openai: OpenAiCompatConfig = { proxyUrl: "x", keyHeader: "x-shape-openai-key", label: "OpenAI" };
    assert.deepEqual(authHeaders(custom, undefined), {});
    assert.deepEqual(authHeaders(custom, ""), {});
    assert.deepEqual(authHeaders(custom, "sk-or-1"), { authorization: "Bearer sk-or-1" });
    assert.deepEqual(authHeaders(openai, "sk-1"), { "x-shape-openai-key": "sk-1" });
    assert.throws(() => authHeaders(openai, ""), /requires an API key/);
  });

  test("plain http stays localhost-only, keyless or not", () => {
    assert.equal(validateBaseUrl("http://localhost:1234/v1").ok, true);
    assert.equal(validateBaseUrl("http://192.168.1.20:1234/v1").ok, false);
    assert.equal(normalizeBaseUrl("http://localhost:11434/v1/chat/completions/"), "http://localhost:11434/v1");
  });
});
