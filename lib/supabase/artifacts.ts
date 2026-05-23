import type { Draft } from "@/lib/drafts";
import type {
  Artifact,
  ArtifactBackend,
  ArtifactVisibility,
  PublishInput,
} from "@/lib/artifacts";
import { ARTIFACTS_EVENT, summarizeDraft } from "@/lib/artifacts";
import { getSupabase } from "./client";

type ArtifactRow = {
  id: string;
  handle: string;
  slug: string;
  title: string;
  summary: string;
  visibility: ArtifactVisibility;
  kind: Draft["kind"];
  draft: Draft;
  published_at: string;
  updated_at: string;
};

function rowToArtifact(r: ArtifactRow): Artifact {
  return {
    id: r.id,
    handle: r.handle,
    slug: r.slug,
    title: r.title,
    summary: r.summary,
    visibility: r.visibility,
    kind: r.kind,
    draft: r.draft,
    publishedAt: new Date(r.published_at).getTime(),
    updatedAt: new Date(r.updated_at).getTime(),
  };
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(ARTIFACTS_EVENT));
  }
}

export const supabaseArtifactBackend: ArtifactBackend = {
  async list() {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from("artifacts")
      .select("*")
      .order("published_at", { ascending: false });
    if (error) {
      console.warn("[shape] artifacts.list failed:", error.message);
      return [];
    }
    return (data as ArtifactRow[]).map(rowToArtifact);
  },

  async listByHandle(handle) {
    const sb = getSupabase();
    if (!sb) return [];
    const { data, error } = await sb
      .from("artifacts")
      .select("*")
      .eq("handle", handle)
      .eq("visibility", "public")
      .order("published_at", { ascending: false });
    if (error) {
      console.warn("[shape] artifacts.listByHandle failed:", error.message);
      return [];
    }
    return (data as ArtifactRow[]).map(rowToArtifact);
  },

  async get(handle, slug) {
    const sb = getSupabase();
    if (!sb) return null;
    const { data, error } = await sb
      .from("artifacts")
      .select("*")
      .eq("handle", handle)
      .eq("slug", slug)
      .maybeSingle();
    if (error) {
      console.warn("[shape] artifacts.get failed:", error.message);
      return null;
    }
    return data ? rowToArtifact(data as ArtifactRow) : null;
  },

  async publish({ handle, slug, title, summary, visibility, draft }: PublishInput) {
    const sb = getSupabase();
    if (!sb) throw new Error("Supabase is not configured.");
    const payload = {
      handle,
      slug,
      title,
      summary: summary || summarizeDraft(draft),
      visibility,
      kind: draft.kind,
      draft,
    };
    const { data, error } = await sb
      .from("artifacts")
      .upsert(payload, { onConflict: "handle,slug" })
      .select("*")
      .single();
    if (error) {
      throw new Error(`Publish failed: ${error.message}`);
    }
    emitChange();
    return rowToArtifact(data as ArtifactRow);
  },

  async unpublish(handle, slug) {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb
      .from("artifacts")
      .delete()
      .eq("handle", handle)
      .eq("slug", slug);
    if (error) {
      console.warn("[shape] artifacts.unpublish failed:", error.message);
      return;
    }
    emitChange();
  },
};
