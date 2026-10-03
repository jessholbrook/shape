import { clientIp, forbidden, isSameOrigin, rateLimit, tooManyRequests } from "../api-guard";
import { validateExperiment, type Experiment } from "../experiment";
import { sha256Hex } from "../sharing";
import {
  LOGIN_TTL_MS,
  SESSION_TTL_MS,
  TEACHER_COOKIE,
  classExperiment,
  clearCookie,
  formatJoinCode,
  isToken,
  linkOrigin,
  memberCookieName,
  newJoinCode,
  newToken,
  normalizeEmail,
  normalizeJoinCode,
  normalizeNickname,
  sessionCookie,
  signSession,
  verifySession,
  type ClassConfig,
} from "../classroom";
import { readCookie } from "./identity";
import type { SendEmail } from "./email";
import type { Rpc } from "./supabase";

/**
 * Classrooms' request paths, with I/O passed in so tests run them against
 * fakes. app/api/teach/*, app/api/classes/* and the /teach and /class pages
 * wire in Supabase and Resend.
 */

export type ClassDeps = {
  config: ClassConfig;
  rpc: Rpc | null;
  send?: SendEmail;
  now?: () => Date;
  /** For sign-in link origins. */
  env?: Record<string, string | undefined>;
};

export type Teacher = { id: string; email: string };

const MEMBER_TTL_MS = 180 * 24 * 60 * 60 * 1000;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store", ...headers },
  });
}

const error = (status: number, message: string, headers?: Record<string, string>) => json(status, { error: { message } }, headers);
const OFF = "Classrooms aren't available right now.";
const isSecure = (req: Request) => new URL(req.url).protocol === "https:";

async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; body: Record<string, unknown> } | { ok: false; res: Response }> {
  const raw = await req.text();
  if (raw.length > maxBytes) return { ok: false, res: error(413, "Request too large.") };
  try {
    const body = JSON.parse(raw);
    if (!body || typeof body !== "object") throw new Error();
    return { ok: true, body };
  } catch {
    return { ok: false, res: error(400, "Body must be a JSON object.") };
  }
}

function gate(req: Request, key: string, limit: number, windowMs: number, now: number): Response | null {
  if (!isSameOrigin(req)) return forbidden();
  const g = rateLimit(`${key}:${clientIp(req)}`, limit, windowMs, now);
  return g.ok ? null : tooManyRequests(g.retryAfter);
}

// --- Who's asking ---------------------------------------------------------------------

/** The signed-in teacher, re-checked against the allowlist on every call. */
export async function currentTeacher(deps: ClassDeps, cookieValue: string | null): Promise<Teacher | null> {
  const config = deps.config;
  if (!config.enabled || !deps.rpc) return null;
  const now = (deps.now ?? (() => new Date()))().getTime();
  const session = await verifySession(config.sessionSecret, cookieValue, now);
  if (!session) return null;
  try {
    return await deps.rpc<Teacher | null>("get_teacher", { p_id: session.id });
  } catch (err) {
    console.error("classroom: teacher lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
}

export type Member = { nickname: string; joined_at: string };

export async function currentMember(deps: ClassDeps, code: string, cookieValue: string | null): Promise<Member | null> {
  if (!deps.config.enabled || !deps.rpc || !isToken(cookieValue, 16)) return null;
  try {
    return await deps.rpc<Member | null>("get_member", { p_code: code, p_token_hash: await sha256Hex(cookieValue) });
  } catch (err) {
    console.error("classroom: member lookup failed", err instanceof Error ? err.message : err);
    return null;
  }
}

// --- Teacher sign-in ---------------------------------------------------------------------

function signInEmail(link: string): { subject: string; text: string; html: string } {
  const subject = "Your Shape sign-in link";
  const text = `Sign in to Shape as a teacher:\n\n${link}\n\nThe link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.`;
  const html = `<p>Sign in to Shape as a teacher:</p><p><a href="${link}">Sign in to Shape</a></p><p style="color:#666">The link works once and expires in 15 minutes. If you didn't ask for it, ignore this email.</p>`;
  return { subject, text, html };
}

/**
 * POST /api/teach/sign-in {email}. Always answers the same way for an address
 * that isn't approved, so the endpoint can't be used to list teachers.
 */
export function createSignInHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc || !deps.send) return error(503, OFF);
    const blocked = gate(req, "teach-sign-in", 5, 10 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const parsed = await readJson(req, 2_000);
    if (!parsed.ok) return parsed.res;
    const email = normalizeEmail(parsed.body.email);
    if (!email) return error(400, "That doesn't look like an email address.");

    const token = newToken(32);
    try {
      const r = await deps.rpc<{ send: boolean; reason?: string }>("request_teacher_login", {
        p_email: email,
        p_token_hash: await sha256Hex(token),
        p_expires_at: new Date(now().getTime() + LOGIN_TTL_MS).toISOString(),
      });
      if (r.send) {
        const link = `${linkOrigin(req.url, deps.env ?? {})}/teach/confirm?token=${token}`;
        await deps.send({ to: email, ...signInEmail(link) });
      }
    } catch (err) {
      console.error("classroom: sign-in failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't send the sign-in email right now. Try again in a few minutes.");
    }
    return json(200, { ok: true });
  };
}

/** POST /api/teach/confirm {token} — the button on the page the email links to. */
export function createConfirmHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "teach-confirm", 10, 10 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const parsed = await readJson(req, 1_000);
    if (!parsed.ok) return parsed.res;
    const token = parsed.body.token;
    const expired = "This sign-in link has expired or already been used. Ask for a new one.";
    if (!isToken(token, 32)) return error(400, expired);
    let teacher: Teacher | null;
    try {
      teacher = await deps.rpc<Teacher | null>("verify_teacher_login", { p_token_hash: await sha256Hex(token) });
    } catch (err) {
      console.error("classroom: confirm failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't sign you in right now. Try the link again in a minute.");
    }
    if (!teacher) return error(400, expired);
    const value = await signSession(config.sessionSecret, { id: teacher.id, email: teacher.email, exp: now().getTime() + SESSION_TTL_MS });
    return json(200, { email: teacher.email }, { "set-cookie": sessionCookie(TEACHER_COOKIE, value, SESSION_TTL_MS, isSecure(req)) });
  };
}

export function signOut(req: Request): Response {
  if (!isSameOrigin(req)) return forbidden();
  return json(200, { ok: true }, { "set-cookie": clearCookie(TEACHER_COOKIE, isSecure(req)) });
}

/** GET /api/teach/me — is classrooms on, and who's signed in. */
export function createMeHandler(deps: ClassDeps) {
  return async function GET(req: Request): Promise<Response> {
    if (!deps.config.enabled) return json(200, { enabled: false, teacher: null });
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    return json(200, { enabled: true, teacher: teacher ? { email: teacher.email } : null });
  };
}

// --- Classes ------------------------------------------------------------------------------

/** POST /api/classes {experiment, title} — a signed-in teacher makes a class. */
export function createClassHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "class-create", 20, 60 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    const parsed = await readJson(req, 200_000);
    if (!parsed.ok) return parsed.res;
    const v = validateExperiment(parsed.body.experiment);
    if (!v.ok) return error(400, `This experiment can't become a class: ${v.reason}`);
    const title = typeof parsed.body.title === "string" ? parsed.body.title.trim() : "";
    if (!title || title.length > 200) return error(400, "Give the class a title (up to 200 characters).");
    if (!v.experiment.question.trim()) return error(400, "Write the experiment's question before making a class.");
    const experiment: Experiment = classExperiment({ ...v.experiment, title }, now().getTime());

    try {
      // Codes are random; on the rare collision, draw again.
      for (let attempt = 0; attempt < 5; attempt++) {
        const r = await deps.rpc<{ ok: boolean; reason?: string; code?: string }>("create_class", {
          p_teacher_id: teacher.id,
          p_code: newJoinCode(),
          p_title: title,
          p_experiment: experiment,
          p_daily_calls: config.classDailyCalls,
        });
        if (r.ok && r.code) return json(201, { code: r.code, display: formatJoinCode(r.code) });
        if (r.reason !== "code_taken") break;
      }
    } catch (err) {
      console.error("classroom: create failed", err instanceof Error ? err.message : err);
    }
    return error(503, "Couldn't make the class right now. Try again in a minute.");
  };
}

/** POST /api/classes/<code>/join {nickname} — a student joins; a cookie remembers them. */
export function createJoinHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request, rawCode: string): Promise<Response> {
    const config = deps.config;
    if (!config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "class-join", 20, 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const code = normalizeJoinCode(rawCode);
    if (!code) return error(404, "No class has that code.");
    const parsed = await readJson(req, 1_000);
    if (!parsed.ok) return parsed.res;
    const nick = normalizeNickname(parsed.body.nickname);
    if (!nick.ok) return error(400, nick.message);

    const token = newToken(16);
    let r: { ok: boolean; reason?: string };
    try {
      r = await deps.rpc("join_class", { p_code: code, p_nickname: nick.nickname, p_token_hash: await sha256Hex(token) });
    } catch (err) {
      console.error("classroom: join failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't join right now. Try again in a minute.");
    }
    if (!r.ok) {
      if (r.reason === "missing") return error(404, "No class has that code.");
      if (r.reason === "closed") return error(409, "This class is closed.");
      if (r.reason === "nickname_taken") return error(409, "Someone in this class already has that nickname. Pick another.");
      return error(503, "Couldn't join right now.");
    }
    return json(200, { nickname: nick.nickname }, { "set-cookie": sessionCookie(memberCookieName(code), token, MEMBER_TTL_MS, isSecure(req)) });
  };
}

// --- Page loaders ----------------------------------------------------------------------------

export type ClassSummary = { code: string; title: string; status: "open" | "closed"; created_at: string; members: number };

export type TeacherClass = {
  id: string;
  code: string;
  title: string;
  status: "open" | "closed";
  experiment: Experiment;
  daily_calls: number;
  created_at: string;
  closed_at: string | null;
  members: { nickname: string; joined_at: string }[];
};

export type StudentClass = { id: string; code: string; title: string; status: "open" | "closed"; experiment: Experiment };

export type Load<T> = { status: "ok"; data: T } | { status: "missing" } | { status: "unavailable" };

async function load<T>(deps: ClassDeps, fn: string, args: Record<string, unknown>): Promise<Load<T>> {
  if (!deps.config.enabled || !deps.rpc) return { status: "unavailable" };
  try {
    const data = await deps.rpc<T | null>(fn, args);
    return data ? { status: "ok", data } : { status: "missing" };
  } catch (err) {
    console.error(`classroom: ${fn} failed`, err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
}

export const listClasses = (deps: ClassDeps, teacher: Teacher) => load<ClassSummary[]>(deps, "list_teacher_classes", { p_teacher_id: teacher.id });

export function loadTeacherClass(deps: ClassDeps, teacher: Teacher, rawCode: string): Promise<Load<TeacherClass>> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return Promise.resolve({ status: "missing" });
  return load<TeacherClass>(deps, "get_teacher_class", { p_teacher_id: teacher.id, p_code: code });
}

export function loadStudentClass(deps: ClassDeps, rawCode: string): Promise<Load<StudentClass>> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return Promise.resolve({ status: "missing" });
  return load<StudentClass>(deps, "get_class", { p_code: code });
}
