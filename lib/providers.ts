export type ProviderId = "anthropic" | "openai";

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
};

export const PROVIDERS: Record<ProviderId, Provider> = {
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
};

export const PROVIDER_LIST: Provider[] = Object.values(PROVIDERS);

export function getModel(providerId: ProviderId, modelId: string): ModelMeta | undefined {
  return PROVIDERS[providerId].models.find((m) => m.id === modelId);
}
