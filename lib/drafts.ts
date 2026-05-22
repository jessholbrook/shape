import type { ProviderId } from "./providers";
import type { ToneValues } from "./tone";

const DRAFTS_KEY = "shape:drafts:log";
const MAX_DRAFTS = 100;

export type DraftKind = "diff" | "tone";

export type DiffDraftConfig = {
  provider: ProviderId;
  model: string;
  system: string;
  temperature: number;
};

export type DiffTurnOutput = {
  text: string;
  status: "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  startMs?: number;
  endMs?: number;
};

export type DiffTurn = {
  id: string;
  userMessage: string;
  outputA: DiffTurnOutput;
  outputB: DiffTurnOutput;
};

export type DiffDraft = {
  id: string;
  kind: "diff";
  title: string;
  configA: DiffDraftConfig;
  configB: DiffDraftConfig;
  turns: DiffTurn[];
  createdAt: number;
  updatedAt: number;
};

/** Pre-multi-turn shape — converted on read. */
type LegacyDiffDraft = Omit<DiffDraft, "turns"> & {
  lastUserMessage?: string;
  lastOutputA?: string;
  lastOutputB?: string;
};

function migrateLegacyDiff(d: LegacyDiffDraft): DiffDraft {
  if ("turns" in d && Array.isArray((d as unknown as DiffDraft).turns)) {
    return d as unknown as DiffDraft;
  }
  const msg = d.lastUserMessage ?? "";
  const turns: DiffTurn[] =
    msg || d.lastOutputA || d.lastOutputB
      ? [
          {
            id: newId(),
            userMessage: msg,
            outputA: { text: d.lastOutputA ?? "", status: "done" },
            outputB: { text: d.lastOutputB ?? "", status: "done" },
          },
        ]
      : [];
  return {
    id: d.id,
    kind: "diff",
    title: d.title,
    configA: d.configA,
    configB: d.configB,
    turns,
    createdAt: d.createdAt,
    updatedAt: d.updatedAt,
  };
}

export type ToneDraft = {
  id: string;
  kind: "tone";
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  brief: string;
  tone: ToneValues;
  lastUserMessage: string;
  lastOutput?: string;
  createdAt: number;
  updatedAt: number;
};

export type Draft = DiffDraft | ToneDraft;

function read(): Draft[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return (parsed as Draft[]).map((d) =>
      d.kind === "diff" ? migrateLegacyDiff(d as unknown as LegacyDiffDraft) : d,
    );
  } catch {
    return [];
  }
}

function write(drafts: Draft[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts));
  window.dispatchEvent(new CustomEvent("shape:drafts-changed"));
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `d_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function listDrafts(): Draft[] {
  return read().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function getDraft(id: string): Draft | null {
  return read().find((d) => d.id === id) ?? null;
}

export type DraftInput =
  | (Omit<DiffDraft, "id" | "createdAt" | "updatedAt"> & { id?: string })
  | (Omit<ToneDraft, "id" | "createdAt" | "updatedAt"> & { id?: string });

/**
 * Save a draft. If `data.id` matches an existing draft, it's updated in place;
 * otherwise a new draft is created. Returns the saved draft (with id + timestamps).
 */
export function saveDraft(data: DraftInput): Draft {
  const now = Date.now();
  const drafts = read();
  if (data.id) {
    const existing = drafts.find((d) => d.id === data.id);
    if (existing) {
      const updated = {
        ...existing,
        ...data,
        id: existing.id,
        createdAt: existing.createdAt,
        updatedAt: now,
      } as Draft;
      const next = drafts.map((d) => (d.id === existing.id ? updated : d));
      write(next);
      return updated;
    }
  }
  const created = {
    ...data,
    id: data.id ?? newId(),
    createdAt: now,
    updatedAt: now,
  } as Draft;
  const next = [created, ...drafts];
  if (next.length > MAX_DRAFTS) next.length = MAX_DRAFTS;
  write(next);
  return created;
}

export function deleteDraft(id: string): void {
  const next = read().filter((d) => d.id !== id);
  write(next);
}

export function clearAllDrafts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFTS_KEY);
  window.dispatchEvent(new CustomEvent("shape:drafts-changed"));
}

/**
 * Suggest a draft title from a brief or user message — first ~50 chars,
 * single line, with "…" if truncated.
 */
export function suggestTitle(seed: string, fallback: string): string {
  const cleaned = seed.replace(/\s+/g, " ").trim();
  if (!cleaned) return fallback;
  if (cleaned.length <= 50) return cleaned;
  return cleaned.slice(0, 47).trimEnd() + "…";
}
