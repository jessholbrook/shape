/**
 * Who's calling, without knowing who's calling.
 *
 * A visitor gets a random id in an httpOnly cookie; the network is the IP.
 * Neither is stored: both are keyed hashes (HMAC-SHA256 with a server
 * secret), and the network hash is salted with the day so it can't be
 * linked across days. The database sees opaque strings.
 */
export const VISITOR_COOKIE = "shape_vid";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** 128 random bits, hex. */
export function newVisitorId(): string {
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function isVisitorId(v: string | null): v is string {
  return !!v && /^[0-9a-f]{32}$/.test(v);
}

export function visitorCookie(id: string, secure: boolean): string {
  return `${VISITOR_COOKIE}=${id}; Path=/; Max-Age=${ONE_YEAR}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export async function hmac(secret: string, value: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(value));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Subjects as the quota table stores them. */
export async function subjects(secret: string, visitorId: string, ip: string, day: string) {
  return {
    visitor: `v:${await hmac(secret, `visitor:${visitorId}`)}`,
    network: `n:${await hmac(secret, `network:${day}:${ip}`)}`,
  };
}
