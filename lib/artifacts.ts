import type { Draft } from "./drafts";
import { ARTIFACTS_EVENT, summarizeDraft, slugForTitle } from "./artifact-utils";
import { supabaseArtifactBackend } from "./supabase/artifacts";

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
  /** Public artifacts only, sorted newest first. */
  listByHandle(handle: string): Promise<Artifact[]>;
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
  window.dispatchEvent(new CustomEvent(ARTIFACTS_EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `a_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Local-storage backend. Used as the default until Supabase env is set. */
export const localArtifactBackend: ArtifactBackend = {
  async list() {
    return readLocal().sort((a, b) => b.publishedAt - a.publishedAt);
  },
  async listByHandle(handle) {
    return readLocal()
      .filter((a) => a.handle === handle && a.visibility === "public")
      .sort((a, b) => b.publishedAt - a.publishedAt);
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
      summary: summary || summarizeDraft(draft),
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

/**
 * Prefers Supabase when env is configured; falls back to the localStorage
 * backend so the publish loop still works offline.
 */
export function getArtifactBackend(): ArtifactBackend {
  if (
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return supabaseArtifactBackend;
  }
  return localArtifactBackend;
}

export { ARTIFACTS_EVENT, summarizeDraft, slugForTitle };
