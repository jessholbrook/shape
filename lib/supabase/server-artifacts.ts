/**
 * Server-side Supabase reads for metadata (`generateMetadata`, OG images).
 * Returns null when env isn't configured — callers fall back to generic copy.
 */
import type { Artifact } from "@/lib/artifacts";
import { supabaseArtifactBackend } from "./artifacts";

function supabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function getArtifactForMeta(
  handle: string,
  slug: string,
): Promise<Artifact | null> {
  if (!supabaseConfigured()) return null;
  try {
    return await supabaseArtifactBackend.get(handle, slug);
  } catch {
    return null;
  }
}

export async function getHandleArtifactsForMeta(
  handle: string,
): Promise<Artifact[]> {
  if (!supabaseConfigured()) return [];
  try {
    return await supabaseArtifactBackend.listByHandle(handle);
  } catch {
    return [];
  }
}
