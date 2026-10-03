/**
 * The smallest possible Supabase client: call a Postgres function through
 * PostgREST with the project's secret key. Server-only — imported by route
 * handlers, never by a component.
 *
 * Key formats: the current secret keys (`sb_secret_…`) are not JWTs and only
 * work in the `apikey` header — sent as a Bearer token they're rejected. The
 * legacy `service_role` key is a JWT and also works as a Bearer token, so it
 * gets both headers. Either key works here.
 */
export type Rpc = <T>(fn: string, args: Record<string, unknown>) => Promise<T>;

export function supabaseRpc(url: string, key: string, fetcher: typeof fetch = fetch): Rpc {
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;
  return async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const res = await fetcher(`${url}/rest/v1/rpc/${fn}`, { method: "POST", headers, body: JSON.stringify(args) });
    if (!res.ok) {
      // PostgREST errors carry no secrets, but keep the message short anyway.
      const text = (await res.text().catch(() => "")).slice(0, 200);
      throw new Error(`Supabase ${fn} ${res.status}: ${text}`);
    }
    const body = await res.text();
    return (body ? JSON.parse(body) : null) as T;
  };
}
