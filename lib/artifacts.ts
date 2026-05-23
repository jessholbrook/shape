import type { Draft } from "./drafts";

export type ArtifactVisibility = "public" | "private";

/**
 * An artifact is a snapshot of a Draft promoted to a shareable URL. Same shape
 * the future Supabase backend will store; same shape used in localStorage in
 * the meantime so the publish loop is testable end-to-end without infra.
 */
export type Artifact = {
  id: string;
  handle: string;
  slug: string;
  title: string;
  summary: string;
  visibility: ArtifactVisibility;
  /** Snapshot of the originating draft at publish time. */
  draft: Draft;
  /** Convenience copy of draft.kind, so listings don't need the full payload. */
  kind: Draft["kind"];
  publishedAt: number;
  updatedAt: number;
};

/**
 * Storage-agnostic interface every backend (localStorage now, Supabase next)
 * implements.
 */
export interface ArtifactBackend {
  list(): Promise<Artifact[]>;
  get(handle: string, slug: string): Promise<Artifact | null>;
  publish(input: PublishInput): Promise<Artifact>;
  unpublish(handle: string, slug: string): Promise<void>;
}

export type PublishInput = {
  handle: string;
  slug: string;
  title: string;
  summary: string;
  visibility: ArtifactVisibility;
  draft: Draft;
};

const ARTIFACTS_KEY = "shape:artifacts:log";
const EVENT = "shape:artifacts-changed";

function readLocal(): Artifact[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ARTIFACTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Artifact[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(artifacts: Artifact[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ARTIFACTS_KEY, JSON.stringify(artifacts));
  window.dispatchEvent(new CustomEvent(EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function deriveSummary(draft: Draft): string {
  switch (draft.kind) {
    case "diff": {
      const turns = draft.turns.length;
      const last = draft.turns[draft.turns.length - 1]?.userMessage ?? "";
      const tail = last ? ` — "${last.slice(0, 80)}${last.length > 80 ? "…" : ""}"` : "";
      return `${turns} ${turns === 1 ? "turn" : "turns"}${tail}`;
    }
    case "tone":
      return draft.brief.slice(0, 140) + (draft.brief.length > 140 ? "…" : "");
    case "persona": {
      const { name, role } = draft.persona;
      return [name, role].filter(Boolean).join(" — ");
    }
    case "refusal":
      return `${draft.probes.length} probe panel`;
    case "evals":
      return `${draft.cases.length} cases × ${draft.rubric.length} criteria`;
    case "choreographer":
      return `${draft.turns.length}-turn flow`;
    default:
      return "";
  }
}

/** Local-storage backend. Used as the default until Supabase env is set. */
export const localArtifactBackend: ArtifactBackend = {
  async list() {
    return readLocal().sort((a, b) => b.publishedAt - a.publishedAt);
  },
  async get(handle, slug) {
    return (
      readLocal().find((a) => a.handle === handle && a.slug === slug) ?? null
    );
  },
  async publish({ handle, slug, title, summary, visibility, draft }) {
    const now = Date.now();
    const all = readLocal();
    const existing = all.find((a) => a.handle === handle && a.slug === slug);
    const next: Artifact = {
      id: existing?.id ?? newId(),
      handle,
      slug,
      title,
      summary: summary || deriveSummary(draft),
      visibility,
      draft,
      kind: draft.kind,
      publishedAt: existing?.publishedAt ?? now,
      updatedAt: now,
    };
    const filtered = all.filter(
      (a) => !(a.handle === handle && a.slug === slug),
    );
    writeLocal([next, ...filtered]);
    return next;
  },
  async unpublish(handle, slug) {
    const filtered = readLocal().filter(
      (a) => !(a.handle === handle && a.slug === slug),
    );
    writeLocal(filtered);
  },
};

/** Picked at module load. Will swap to Supabase once env is configured. */
export function getArtifactBackend(): ArtifactBackend {
  // Future: return supabaseArtifactBackend if env is set.
  return localArtifactBackend;
}

/** Suggest a URL-safe slug from a title. */
export function slugForTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Returns the convention summary for a given draft. Exposed for previews. */
export function summarizeDraft(draft: Draft): string {
  return deriveSummary(draft);
}

export const ARTIFACTS_EVENT = EVENT;
