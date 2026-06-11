import type { ProviderId } from "./providers";
import type { ToneValues } from "./tone";
import type { PersonaValues } from "./persona";
import type { Probe, ProbeResult } from "./refusal";
import type { Criterion, EvalCase, CaseResult } from "./evals";
import type { ChoreographedTurn } from "./choreographer";

const DRAFTS_KEY = "shape:drafts:log";
const MAX_DRAFTS = 100;

export type DraftKind =
  | "diff"
  | "tone"
  | "persona"
  | "refusal"
  | "evals"
  | "choreographer"
  | "case-study";

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
  note?: string;
  /** Phrases pinned at the time this turn was sent — kept so reopening a draft
   *  preserves which carry-throughs the model saw on each turn. */
  pinsApplied?: string[];
};

export type DiffDraft = {
  id: string;
  kind: "diff";
  title: string;
  configA: DiffDraftConfig;
  configB: DiffDraftConfig;
  turns: DiffTurn[];
  /** Live pin list — phrases the user has highlighted to inject into future
   *  turns. Per-turn snapshots live on DiffTurn.pinsApplied. */
  pins?: string[];
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

export type PersonaTranscriptMessage = {
  role: "user" | "assistant";
  content: string;
};

export type PersonaDraft = {
  id: string;
  kind: "persona";
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  persona: PersonaValues;
  lastUserMessage: string;
  lastOutput?: string;
  /** Full conversation. Pre-multi-turn drafts only have the last pair above. */
  transcript?: PersonaTranscriptMessage[];
  createdAt: number;
  updatedAt: number;
};

export type RefusalDraft = {
  id: string;
  kind: "refusal";
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  /** System prompt with refusal guidelines. */
  guidelines: string;
  probes: Probe[];
  /** Results keyed by probe id. */
  results: Record<string, ProbeResult>;
  createdAt: number;
  updatedAt: number;
};

export type EvalsDraft = {
  id: string;
  kind: "evals";
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  /** System prompt under test. */
  systemPrompt: string;
  rubric: Criterion[];
  cases: EvalCase[];
  /** Per-case results, keyed by case id. */
  results: Record<string, CaseResult>;
  createdAt: number;
  updatedAt: number;
};

export type ChoreographerDraft = {
  id: string;
  kind: "choreographer";
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  systemPrompt: string;
  turns: ChoreographedTurn[];
  createdAt: number;
  updatedAt: number;
};

export type CaseStudyDraft = {
  id: string;
  kind: "case-study";
  /** Which Studio produced this draft (e.g. "research-interview-assistant"). */
  studioId: string;
  title: string;
  provider: ProviderId;
  model: string;
  temperature: number;
  brief: string;
  audience: string;
  persona: PersonaValues;
  tone: ToneValues;
  sample: {
    userMessage: string;
    output?: string;
    inputTokens?: number;
    outputTokens?: number;
    costUsd?: number;
  };
  reflection: string;
  createdAt: number;
  updatedAt: number;
};

export type Draft =
  | DiffDraft
  | ToneDraft
  | PersonaDraft
  | RefusalDraft
  | EvalsDraft
  | ChoreographerDraft
  | CaseStudyDraft;

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
  | (Omit<ToneDraft, "id" | "createdAt" | "updatedAt"> & { id?: string })
  | (Omit<PersonaDraft, "id" | "createdAt" | "updatedAt"> & { id?: string })
  | (Omit<RefusalDraft, "id" | "createdAt" | "updatedAt"> & { id?: string })
  | (Omit<EvalsDraft, "id" | "createdAt" | "updatedAt"> & { id?: string })
  | (Omit<ChoreographerDraft, "id" | "createdAt" | "updatedAt"> & {
      id?: string;
    })
  | (Omit<CaseStudyDraft, "id" | "createdAt" | "updatedAt"> & { id?: string });

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

/**
 * Duplicate a draft. Returns the new draft (new id, new timestamps, title with
 * " (copy)" suffix) or null if the source doesn't exist.
 */
export function duplicateDraft(id: string): Draft | null {
  const source = read().find((d) => d.id === id);
  if (!source) return null;
  const now = Date.now();
  const copy = {
    ...source,
    id: newId(),
    title: `${source.title} (copy)`,
    createdAt: now,
    updatedAt: now,
  } as Draft;
  const next = [copy, ...read()];
  if (next.length > MAX_DRAFTS) next.length = MAX_DRAFTS;
  write(next);
  return copy;
}

/**
 * Restore a draft snapshot — used for undoing a delete. Writes the draft back
 * with its original id and timestamps so the entry slots into the list as if
 * it had never been removed.
 */
export function restoreDraft(draft: Draft): void {
  const existing = read().filter((d) => d.id !== draft.id);
  write([draft, ...existing]);
}

const EXPORT_SCHEMA = "shape.draft.v1";

/**
 * Export a draft to a portable JSON string. Includes everything except a small
 * provenance header so consumers know what they're looking at.
 */
export function exportDraftJson(draft: Draft): string {
  const payload = {
    $schema: EXPORT_SCHEMA,
    exportedAt: new Date().toISOString(),
    draft,
  };
  return JSON.stringify(payload, null, 2);
}

export type ImportResult =
  | { ok: true; draft: Draft }
  | { ok: false; reason: string };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function validateDraftShape(d: unknown): { ok: true } | { ok: false; reason: string } {
  if (!isObject(d)) return { ok: false, reason: "Draft is not an object." };
  const kind = d.kind;
  if (
    kind !== "diff" &&
    kind !== "tone" &&
    kind !== "persona" &&
    kind !== "refusal" &&
    kind !== "evals" &&
    kind !== "choreographer" &&
    kind !== "case-study"
  ) {
    return { ok: false, reason: `Unknown draft kind: ${String(kind)}` };
  }
  if (typeof d.title !== "string") {
    return { ok: false, reason: "Draft is missing a title." };
  }
  if (kind === "diff") {
    if (!isObject(d.configA) || !isObject(d.configB)) {
      return { ok: false, reason: "Diff draft is missing configA / configB." };
    }
    if (!Array.isArray(d.turns)) {
      return { ok: false, reason: "Diff draft is missing turns." };
    }
  } else if (kind === "tone") {
    if (!isObject(d.tone) || typeof d.brief !== "string") {
      return { ok: false, reason: "Tone draft is missing tone values or brief." };
    }
  } else if (kind === "persona") {
    if (!isObject(d.persona)) {
      return { ok: false, reason: "Persona draft is missing persona values." };
    }
  } else if (kind === "refusal") {
    if (!Array.isArray(d.probes) || typeof d.guidelines !== "string") {
      return {
        ok: false,
        reason: "Refusal draft is missing probes or guidelines.",
      };
    }
  } else if (kind === "evals") {
    if (
      !Array.isArray(d.rubric) ||
      !Array.isArray(d.cases) ||
      typeof d.systemPrompt !== "string"
    ) {
      return {
        ok: false,
        reason: "Evals draft is missing rubric, cases, or systemPrompt.",
      };
    }
  } else if (kind === "choreographer") {
    if (!Array.isArray(d.turns) || typeof d.systemPrompt !== "string") {
      return {
        ok: false,
        reason: "Choreographer draft is missing turns or systemPrompt.",
      };
    }
  } else if (kind === "case-study") {
    if (
      typeof d.brief !== "string" ||
      typeof d.studioId !== "string" ||
      !isObject(d.persona) ||
      !isObject(d.tone) ||
      !isObject(d.sample)
    ) {
      return {
        ok: false,
        reason:
          "Case study draft is missing brief, studioId, persona, tone, or sample.",
      };
    }
  }
  return { ok: true };
}

/**
 * Validate + save a draft from an exported JSON payload. Always generates a
 * fresh id and timestamps so imports never collide with existing local drafts.
 * Appends " (imported)" to the title to make provenance obvious in the
 * notebook.
 */
export function importDraftJson(json: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, reason: "Not valid JSON." };
  }
  if (!isObject(parsed)) {
    return { ok: false, reason: "Top-level value is not an object." };
  }
  if (parsed.$schema !== EXPORT_SCHEMA) {
    return {
      ok: false,
      reason: `Expected $schema "${EXPORT_SCHEMA}", got ${
        parsed.$schema ? `"${String(parsed.$schema)}"` : "no schema"
      }.`,
    };
  }
  if (!isObject(parsed.draft)) {
    return { ok: false, reason: "Missing `draft` payload." };
  }
  const shape = validateDraftShape(parsed.draft);
  if (!shape.ok) return shape;

  const incoming = parsed.draft as unknown as Draft;
  const now = Date.now();
  const created = {
    ...incoming,
    id: newId(),
    title: `${incoming.title} (imported)`,
    createdAt: now,
    updatedAt: now,
  } as Draft;
  const next = [created, ...read()];
  if (next.length > MAX_DRAFTS) next.length = MAX_DRAFTS;
  write(next);
  return { ok: true, draft: created };
}

export function clearAllDrafts(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DRAFTS_KEY);
  window.dispatchEvent(new CustomEvent("shape:drafts-changed"));
}

/**
 * Where this draft can be opened for editing. Studios live under /build/,
 * everything else under /play/. Pairs with the originating client component's
 * `?draft=<id>` hydration.
 */
export function draftEditorHref(draft: Draft): string {
  switch (draft.kind) {
    case "diff":
      return `/play/diff?draft=${draft.id}`;
    case "tone":
      return `/play/tone?draft=${draft.id}`;
    case "persona":
      return `/play/persona?draft=${draft.id}`;
    case "refusal":
      return `/play/refusal?draft=${draft.id}`;
    case "evals":
      return `/play/evals?draft=${draft.id}`;
    case "choreographer":
      return `/play/choreographer?draft=${draft.id}`;
    case "case-study":
      return `/build/${draft.studioId}?draft=${draft.id}`;
  }
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
