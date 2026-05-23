/**
 * Lazy Supabase client. Returns null when env isn't configured so callers can
 * fall back to a local backend without crashing.
 *
 * The actual @supabase/supabase-js dependency isn't installed in this PR —
 * `getSupabase()` reads env to decide whether to attempt a dynamic import.
 * When the dep is missing, the helper returns null and logs a one-line hint.
 *
 * Wire this up by:
 *   1. `npm install @supabase/supabase-js`
 *   2. Setting NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
 *   3. Running supabase/migrations/0001_artifacts.sql against your project
 */

export type SupabaseClient = {
  // Subset of the @supabase/supabase-js surface we use. Kept narrow so the
  // local backend and Supabase backend stay swappable.
  from: (table: string) => {
    select: (cols?: string) => Promise<{ data: unknown; error: Error | null }>;
    insert: (rows: unknown) => Promise<{ data: unknown; error: Error | null }>;
    upsert: (rows: unknown, opts?: unknown) => Promise<{ data: unknown; error: Error | null }>;
    delete: () => { eq: (col: string, val: string) => Promise<{ error: Error | null }> };
  };
};

let cached: SupabaseClient | null | undefined;

export function supabaseConfigured(): boolean {
  return (
    !!process.env.NEXT_PUBLIC_SUPABASE_URL &&
    !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Returns a Supabase client if both env vars + the @supabase/supabase-js
 * package are available; null otherwise. Safe to call from any context.
 */
export async function getSupabase(): Promise<SupabaseClient | null> {
  if (cached !== undefined) return cached;
  if (!supabaseConfigured()) {
    cached = null;
    return null;
  }
  try {
    // Dynamic import so the bundle stays small when env isn't set.
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-expect-error — optional peer dep, install with `npm i @supabase/supabase-js`
    const mod = await import("@supabase/supabase-js");
    cached = mod.createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    ) as SupabaseClient;
    return cached;
  } catch {
    if (typeof console !== "undefined") {
      console.warn(
        "[shape] Supabase env vars set but @supabase/supabase-js not installed. Run `npm i @supabase/supabase-js` to enable cloud publishing.",
      );
    }
    cached = null;
    return null;
  }
}
