import { ProviderId, getModel } from "./providers";

const USAGE_KEY = "shape:usage:log";
const MAX_RECORDS = 500;

export type UsageRecord = {
  ts: number;
  provider: ProviderId;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

export function calcCost(
  providerId: ProviderId,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const meta = getModel(providerId, modelId);
  if (!meta) return 0;
  const input = (inputTokens / 1_000_000) * meta.inputPer1M;
  const output = (outputTokens / 1_000_000) * meta.outputPer1M;
  return input + output;
}

function read(): UsageRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(USAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UsageRecord[];
  } catch {
    return [];
  }
}

function write(records: UsageRecord[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USAGE_KEY, JSON.stringify(records));
  window.dispatchEvent(new CustomEvent("shape:usage-changed"));
}

export function recordUsage(record: Omit<UsageRecord, "ts" | "costUsd">) {
  const cost = calcCost(
    record.provider,
    record.model,
    record.inputTokens,
    record.outputTokens,
  );
  const next = read();
  next.push({ ...record, costUsd: cost, ts: Date.now() });
  if (next.length > MAX_RECORDS) {
    next.splice(0, next.length - MAX_RECORDS);
  }
  write(next);
}

export function clearUsage() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USAGE_KEY);
  window.dispatchEvent(new CustomEvent("shape:usage-changed"));
}

export function getAllUsage(): UsageRecord[] {
  return read();
}

function startOfTodayMs(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export type UsageSummary = {
  totalCost: number;
  totalTokens: number;
  callCount: number;
  byProvider: Partial<
    Record<ProviderId, { cost: number; tokens: number; calls: number }>
  >;
};

export function summarize(records: UsageRecord[]): UsageSummary {
  const sum: UsageSummary = {
    totalCost: 0,
    totalTokens: 0,
    callCount: records.length,
    byProvider: {},
  };
  for (const r of records) {
    sum.totalCost += r.costUsd;
    sum.totalTokens += r.inputTokens + r.outputTokens;
    const entry = sum.byProvider[r.provider] ?? {
      cost: 0,
      tokens: 0,
      calls: 0,
    };
    entry.cost += r.costUsd;
    entry.tokens += r.inputTokens + r.outputTokens;
    entry.calls += 1;
    sum.byProvider[r.provider] = entry;
  }
  return sum;
}

export function getTodaySummary(): UsageSummary {
  const start = startOfTodayMs();
  return summarize(read().filter((r) => r.ts >= start));
}
