import type { ChatCall, ChatEvent } from "./types";
import {
  openAiCompatibleChat,
  type OpenAiCompatConfig,
} from "./openai-compatible";
import {
  customChatUrl,
  customModelsUrl,
  getCustomEndpoint,
} from "../custom-endpoint";

/**
 * Custom OpenAI-compatible endpoint — OpenRouter, Groq, Together, a local
 * LM Studio or Ollama. Called straight from the browser with a bearer key;
 * never proxied, because a relay to a user-supplied URL is an open relay.
 * The endpoint has to allow browser calls (OpenRouter and local servers do);
 * one that doesn't fails with a CORS error, which the message names.
 */
function config(): OpenAiCompatConfig {
  const endpoint = getCustomEndpoint();
  if (!endpoint) {
    throw new Error("Set a custom endpoint URL in Keys before running.");
  }
  return {
    proxyUrl: customChatUrl(endpoint.baseUrl),
    keyHeader: "authorization",
    bearer: true,
    label: "Custom endpoint",
  };
}

export async function* customChat(call: ChatCall): AsyncIterable<ChatEvent> {
  const cfg = config();
  try {
    yield* openAiCompatibleChat(call, cfg);
  } catch (err) {
    throw corsAware(err);
  }
}

/** The connection test is the model list — cheaper than a completion, and it validates the base URL. */
export async function pingCustom(apiKey: string): Promise<void> {
  const endpoint = getCustomEndpoint();
  if (!endpoint) {
    throw new Error("Set a custom endpoint URL first.");
  }
  let res: Response;
  try {
    res = await fetch(customModelsUrl(endpoint.baseUrl), {
      headers: apiKey ? { authorization: `Bearer ${apiKey}` } : {},
    });
  } catch (err) {
    throw corsAware(err);
  }
  if (!res.ok) {
    throw new Error(`Custom endpoint ${res.status}: ${res.statusText}`);
  }
}

/** A bare "Failed to fetch" from the browser is almost always CORS or a dead host; say so. */
function corsAware(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  if (/failed to fetch|networkerror|load failed/i.test(message)) {
    return new Error(
      "The endpoint didn't answer the browser. Either the URL is wrong, the server is down, or it doesn't allow browser (CORS) requests — Shape calls custom endpoints directly, never through a proxy.",
    );
  }
  return err instanceof Error ? err : new Error(message);
}
