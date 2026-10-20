import type { Experiment } from "./experiment";

/**
 * Classrooms: a teacher turns a lab experiment into a class; students join
 * with a short code and a nickname and run the same experiment, so the
 * class's results pool into one dataset.
 *
 * Pure — config, codes, nicknames, emails, and signed sessions. The server
 * handler and pages build on it; tests run it without a network.
 */

export type ClassConfig =
  | {
      enabled: true;
      supabaseUrl: string;
      supabaseKey: string;
      /** Signs teacher session cookies. */
      sessionSecret: string;
      resendKey: string;
      emailFrom: string;
      /** Model calls a class may make per day on the free tier. */
      classDailyCalls: number;
    }
  | { enabled: false; reason: string };

type Env = Record<string, string | undefined>;

/** Off unless SHAPE_CLASSROOMS is "on" and every setting it needs is present. */
export function readClassConfig(env: Env): ClassConfig {
  if (env.SHAPE_CLASSROOMS?.trim().toLowerCase() !== "on") {
    return { enabled: false, reason: 'switched off (SHAPE_CLASSROOMS is not "on")' };
  }
  const missing = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "CLASSROOM_SESSION_SECRET", "RESEND_API_KEY", "EMAIL_FROM"].filter(
    (k) => !env[k]?.trim(),
  );
  if (missing.length) return { enabled: false, reason: `missing ${missing.join(", ")}` };
  const secret = env.CLASSROOM_SESSION_SECRET!.trim();
  if (secret.length < 32) return { enabled: false, reason: "CLASSROOM_SESSION_SECRET must be at least 32 characters" };
  const calls = Number(env.CLASS_DAILY_CALLS);
  return {
    enabled: true,
    supabaseUrl: env.SUPABASE_URL!.trim().replace(/\/$/, ""),
    supabaseKey: env.SUPABASE_SERVICE_ROLE_KEY!.trim(),
    sessionSecret: secret,
    resendKey: env.RESEND_API_KEY!.trim(),
    emailFrom: env.EMAIL_FROM!.trim(),
    classDailyCalls: Number.isFinite(calls) && calls > 0 ? Math.floor(calls) : 3000,
  };
}

// --- Join codes --------------------------------------------------------------------

/**
 * 23 characters that survive being read off a projector or said across a
 * room: no 0/O, 1/I/L, 2/Z, 5/S, 6/G, 8/B.
 */
export const CODE_ALPHABET = "ACDEFHJKMNPQRTUVWXY3479";
export const CODE_LENGTH = 6;
const CODE_RE = new RegExp(`^[${CODE_ALPHABET}]{${CODE_LENGTH}}$`);

export function newJoinCode(random: (n: number) => Uint8Array = randomBytes): string {
  let out = "";
  while (out.length < CODE_LENGTH) {
    for (const b of random(CODE_LENGTH * 2)) {
      // 230 = 10 × 23: rejecting the rest keeps every character equally likely.
      if (b < 230 && out.length < CODE_LENGTH) out += CODE_ALPHABET[b % 23];
    }
  }
  return out;
}

/** What a person typed — "kq7 m2p", "KQ7-M2P" — as the stored code, or null. */
export function normalizeJoinCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_RE.test(code) ? code : null;
}

/** "KQ7M2P" → "KQ7-M2P", for reading aloud and writing on a board. */
export function formatJoinCode(code: string): string {
  return `${code.slice(0, 3)}-${code.slice(3)}`;
}

// --- Nicknames, emails -----------------------------------------------------------

export function normalizeNickname(input: unknown): { ok: true; nickname: string } | { ok: false; message: string } {
  if (typeof input !== "string") return { ok: false, message: "Pick a nickname." };
  const nickname = input.normalize("NFC").replace(/\s+/g, " ").trim();
  if (!nickname) return { ok: false, message: "Pick a nickname." };
  if (nickname.length > 24) return { ok: false, message: "Keep it to 24 characters." };
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(nickname)) return { ok: false, message: "Letters, numbers, spaces, and . _ ' - only." };
  // A nickname, not an identity: don't collect addresses by accident.
  if (nickname.includes("@")) return { ok: false, message: "A nickname, not an email." };
  return { ok: true, nickname };
}

export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

// --- Tokens and sessions -------------------------------------------------------------

function randomBytes(n: number): Uint8Array {
  return globalThis.crypto.getRandomValues(new Uint8Array(n));
}

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");

/** 256 bits for sign-in links, 128 for member cookies. Hex. */
export function newToken(bytes = 32, random: (n: number) => Uint8Array = randomBytes): string {
  return toHex(random(bytes));
}

export function isToken(v: unknown, bytes = 32): v is string {
  return typeof v === "string" && new RegExp(`^[0-9a-f]{${bytes * 2}}$`).test(v);
}

export const LOGIN_TTL_MS = 15 * 60 * 1000;
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const TEACHER_COOKIE = "shape_teacher";

/** One member cookie per class, so a student can be in two classes at once. */
export const memberCookieName = (code: string) => `shape_class_${code}`;

export type TeacherSession = { id: string; email: string; exp: number };

async function sign(secret: string, payload: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toHex(new Uint8Array(await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(payload))));
}

function b64url(text: string): string {
  const bin = String.fromCharCode(...new TextEncoder().encode(text));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(s: string): string {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** "<base64url payload>.<hmac>" — tamper-evident, not secret. */
export async function signSession(secret: string, session: TeacherSession): Promise<string> {
  const payload = b64url(JSON.stringify(session));
  return `${payload}.${await sign(secret, payload)}`;
}

export async function verifySession(secret: string, value: string | null, now: number): Promise<TeacherSession | null> {
  if (!value) return null;
  const [payload, mac, extra] = value.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const expected = await sign(secret, payload);
  // Compare every character: no early exit for a timing side channel.
  if (expected.length !== mac.length) return null;
  let diff = 0;
  for (let i = 0; i < mac.length; i++) diff |= expected.charCodeAt(i) ^ mac.charCodeAt(i);
  if (diff !== 0) return null;
  try {
    const s = JSON.parse(unb64url(payload)) as TeacherSession;
    if (typeof s.id !== "string" || typeof s.email !== "string" || typeof s.exp !== "number" || s.exp <= now) return null;
    return s;
  } catch {
    return null;
  }
}

export function sessionCookie(name: string, value: string, maxAgeMs: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${Math.floor(maxAgeMs / 1000)}; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export function clearCookie(name: string, secure: boolean): string {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
}

// --- What a class runs -----------------------------------------------------------------

/**
 * The class's copy of an experiment: the design, locked. No runs (each
 * student makes their own), and the hypothesis already fixed — it's the
 * teacher's, stated before anyone in the class has run anything.
 */
export function classExperiment(e: Experiment, now: number): Experiment {
  return { ...e, runs: [], hypothesisLockedAt: e.hypothesisLockedAt ?? now, forkedFrom: undefined, updatedAt: now };
}

// --- Where sign-in links point --------------------------------------------------------

/**
 * The origin a sign-in email links to. Never the request's Host as given — a
 * forged Host would mail a teacher a working token on someone else's domain.
 * Only the site's own domains, this deployment's Vercel URLs, and localhost
 * are trusted; anything else falls back to the canonical site.
 */
export function linkOrigin(requestUrl: string, env: Env): string {
  const site = env.NEXT_PUBLIC_SITE_URL?.trim();
  const canonical = site ? (site.startsWith("http") ? site : `https://${site}`).replace(/\/$/, "") : "https://shape-models.com";
  const trusted = new Set(["shape-models.com", "www.shape-models.com"]);
  for (const v of [site, env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (!v) continue;
    try {
      trusted.add(new URL(v.startsWith("http") ? v : `https://${v}`).host.toLowerCase());
    } catch {
      // Malformed env: skip it.
    }
  }
  try {
    const u = new URL(requestUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return u.origin;
    if (trusted.has(u.host.toLowerCase())) return `https://${u.host.toLowerCase()}`;
  } catch {
    // Fall through.
  }
  return canonical;
}
