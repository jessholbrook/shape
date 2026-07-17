export type ProviderId = "webllm" | "anthropic" | "openai" | "gemini";

export type Provider = {
  id: ProviderId;
  name: string;
  keyPrefix: string;
  keyMinLength: number;
  signupUrl: string;
  consoleUrl: string;
  defaultModel: string;
  models: ModelMeta[];
};

export type ModelMeta = {
  id: string;
  name: string;
  /** Cost per 1M input tokens, USD */
  inputPer1M: number;
  /** Cost per 1M output tokens, USD */
  outputPer1M: number;
  tier: "frontier" | "balanced" | "fast";
  /** Approximate first-run download size in MB. WebLLM only. */
  downloadMb?: number;
  /** Optional one-line description shown in the model picker. */
  blurb?: string;
};

export const PROVIDERS: Record<ProviderId, Provider> = {
  webllm: {
    id: "webllm",
    name: "Free (in browser)",
    keyPrefix: "",
    keyMinLength: 0,
    signupUrl: "",
    consoleUrl: "",
    defaultModel: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
    models: [
      {
        id: "Qwen2.5-0.5B-Instruct-q4f16_1-MLC",
        name: "Qwen 2.5 0.5B",
        inputPer1M: 0,
        outputPer1M: 0,
        tier: "fast",
        downloadMb: 280,
        blurb: "Alibaba · smallest · fastest first run",
      },
      {
        id: "Llama-3.2-1B-Instruct-q4f16_1-MLC",
        name: "Llama 3.2 1B",
        inputPer1M: 0,
        outputPer1M: 0,
        tier: "balanced",
        downloadMb: 1100,
        blurb: "Meta · balanced default · recommended",
      },
      {
        id: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
        name: "Llama 3.2 3B",
        inputPer1M: 0,
        outputPer1M: 0,
        tier: "frontier",
        downloadMb: 2000,
        blurb: "Meta · best free tier quality",
      },
      {
        id: "Phi-3.5-mini-instruct-q4f16_1-MLC",
        name: "Phi 3.5 Mini",
        inputPer1M: 0,
        outputPer1M: 0,
        tier: "frontier",
        downloadMb: 2200,
        blurb: "Microsoft · different family for diff-mode comparison",
      },
    ],
  },
  anthropic: {
    id: "anthropic",
    name: "Anthropic",
    keyPrefix: "sk-ant-",
    keyMinLength: 40,
    signupUrl: "https://console.anthropic.com/",
    consoleUrl: "https://console.anthropic.com/settings/keys",
    defaultModel: "claude-sonnet-4-6",
    models: [
      {
        id: "claude-opus-4-7",
        name: "Claude Opus 4.7",
        inputPer1M: 15,
        outputPer1M: 75,
        tier: "frontier",
      },
      {
        id: "claude-sonnet-4-6",
        name: "Claude Sonnet 4.6",
        inputPer1M: 3,
        outputPer1M: 15,
        tier: "balanced",
      },
      {
        id: "claude-haiku-4-5",
        name: "Claude Haiku 4.5",
        inputPer1M: 1,
        outputPer1M: 5,
        tier: "fast",
      },
    ],
  },
  openai: {
    id: "openai",
    name: "OpenAI",
    keyPrefix: "sk-",
    keyMinLength: 40,
    signupUrl: "https://platform.openai.com/",
    consoleUrl: "https://platform.openai.com/api-keys",
    defaultModel: "gpt-4o",
    models: [
      {
        id: "gpt-4o",
        name: "GPT-4o",
        inputPer1M: 2.5,
        outputPer1M: 10,
        tier: "frontier",
      },
      {
        id: "gpt-4o-mini",
        name: "GPT-4o mini",
        inputPer1M: 0.15,
        outputPer1M: 0.6,
        tier: "fast",
      },
    ],
  },
  gemini: {
    id: "gemini",
    name: "Google Gemini",
    keyPrefix: "AIza",
    keyMinLength: 30,
    signupUrl: "https://aistudio.google.com/",
    consoleUrl: "https://aistudio.google.com/apikey",
    defaultModel: "gemini-2.5-flash",
    models: [
      {
        id: "gemini-2.5-pro",
        name: "Gemini 2.5 Pro",
        // Base tier pricing (≤200K context); Google bills higher above that.
        inputPer1M: 1.25,
        outputPer1M: 10,
        tier: "frontier",
      },
      {
        id: "gemini-2.5-flash",
        name: "Gemini 2.5 Flash",
        inputPer1M: 0.3,
        outputPer1M: 2.5,
        tier: "balanced",
      },
      {
        id: "gemini-2.5-flash-lite",
        name: "Gemini 2.5 Flash-Lite",
        inputPer1M: 0.1,
        outputPer1M: 0.4,
        tier: "fast",
      },
    ],
  },
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

/** Providers that require an API key. WebLLM is excluded. */
export const BYOK_PROVIDERS: Provider[] = PROVIDER_LIST.filter(
  (p) => p.id !== "webllm",
);

export function getModel(providerId: ProviderId, modelId: string): ModelMeta | undefined {
  return PROVIDERS[providerId].models.find((m) => m.id === modelId);
}

/**
 * Whether this provider requires the user to bring their own API key. WebLLM
 * runs entirely in the browser; everything else needs auth.
 */
export function providerNeedsKey(provider: ProviderId): boolean {
  return provider !== "webllm";
}

/**
 * The provider a fresh playground should default to. If the user has saved a
 * BYOK key, prefer it (Anthropic before OpenAI, matching BYOK_PROVIDERS order)
 * so the playground opens on the provider they actually set up. Otherwise fall
 * back to the free in-browser model so first-timers can run with no key.
 */
export function preferredProvider(
  keys: Partial<Record<ProviderId, string>>,
): ProviderId {
  for (const p of BYOK_PROVIDERS) {
    if (keys[p.id]) return p.id;
  }
  return "webllm";
}
