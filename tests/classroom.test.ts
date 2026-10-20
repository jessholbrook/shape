/**
 * Classrooms, part 1: teacher sign-in, making a class, joining one. Tested
 * against a fake database and a fake mailer — no network.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { starterExperiment, type Experiment } from "../lib/experiment";
import {
  CODE_ALPHABET,
  TEACHER_COOKIE,
  classExperiment,
  formatJoinCode,
  isToken,
  linkOrigin,
  memberCookieName,
  newJoinCode,
  normalizeEmail,
  normalizeJoinCode,
  normalizeNickname,
  readClassConfig,
  signSession,
  verifySession,
  type ClassConfig,
} from "../lib/classroom";
import {
  createClassHandler,
  createConfirmHandler,
  createJoinHandler,
  createMeHandler,
  createSignInHandler,
  currentMember,
  currentTeacher,
  signOut,
} from "../lib/server/classroom-handler";
import { sha256Hex } from "../lib/sharing";
import type { Email } from "../lib/server/email";
import type { Rpc } from "../lib/server/supabase";

const SECRET = "s".repeat(40);
const ENV = {
  SHAPE_CLASSROOMS: "on",
  SUPABASE_URL: "https://example.supabase.co/",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  CLASSROOM_SESSION_SECRET: SECRET,
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Shape <hello@shape-models.com>",
};
const ON = readClassConfig(ENV) as Extract<ClassConfig, { enabled: true }>;
const OFF = readClassConfig({});
const ORIGIN = "https://shape-models.com";
const NOW = () => new Date("2026-10-05T12:00:00Z");
const TEACHER = { id: "11111111-1111-1111-1111-111111111111", email: "prof@uni.edu" };

let ip = 0;
function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `192.0.2.${++ip}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fakeRpc(answers: Record<string, unknown | Error | ((args: Record<string, unknown>) => unknown)>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return (typeof a === "function" ? a(args) : a) as T;
  };
  return { rpc, calls };
}

function fakeMailer() {
  const sent: Email[] = [];
  return { send: async (e: Email) => void sent.push(e), sent };
}

async function teacherCookie(exp = NOW().getTime() + 60_000) {
  return `${TEACHER_COOKIE}=${encodeURIComponent(await signSession(SECRET, { ...TEACHER, exp }))}`;
}

function experiment(): Experiment {
  return { ...starterExperiment({ provider: "shape-free", model: "claude-haiku-4-5" }, 1_700_000_000_000), title: "Agreement drift" };
}

// --- Pure pieces ----------------------------------------------------------------------

test("config: off unless switched on and fully set; the session secret must be long", () => {
  assert.equal(OFF.enabled, false);
  assert.ok(ON.enabled);
  assert.equal(ON.classDailyCalls, 3000);
  const short = readClassConfig({ ...ENV, CLASSROOM_SESSION_SECRET: "short" });
  assert.ok(!short.enabled && /32 characters/.test(short.reason));
  const missing = readClassConfig({ ...ENV, RESEND_API_KEY: "" });
  assert.ok(!missing.enabled && missing.reason === "missing RESEND_API_KEY");
});

test("join codes: 6 characters from an unambiguous alphabet; typed variants normalize", () => {
  for (let i = 0; i < 300; i++) {
    const c = newJoinCode();
    assert.equal(c.length, 6);
    for (const ch of c) assert.ok(CODE_ALPHABET.includes(ch), c);
  }
  assert.ok(!/[0O1IL2Z5S6G8B]/.test(CODE_ALPHABET));
  assert.equal(normalizeJoinCode("kq7-m3p"), "KQ7M3P");
  assert.equal(normalizeJoinCode(" KQ7 M3P "), "KQ7M3P");
  assert.equal(normalizeJoinCode("KQ7M3"), null);
  assert.equal(normalizeJoinCode("KQ7M3O"), null); // O isn't in the alphabet
  assert.equal(normalizeJoinCode(42), null);
  assert.equal(formatJoinCode("KQ7M3P"), "KQ7-M3P");
  assert.equal(memberCookieName("KQ7M3P"), "shape_class_KQ7M3P");
});

test("nicknames and emails: trimmed and checked; a nickname can't be an address", () => {
  assert.deepEqual(normalizeNickname("  Ada   L. "), { ok: true, nickname: "Ada L." });
  assert.deepEqual(normalizeNickname("Zoë"), { ok: true, nickname: "Zoë" });
  assert.ok(!normalizeNickname("").ok);
  assert.ok(!normalizeNickname("x".repeat(25)).ok);
  assert.ok(!normalizeNickname("<script>").ok);
  assert.ok(!normalizeNickname("ada@uni.edu").ok);
  assert.equal(normalizeEmail("  Prof@Uni.EDU "), "prof@uni.edu");
  assert.equal(normalizeEmail("not an email"), null);
  assert.equal(normalizeEmail("a@b"), null);
});

test("sessions: signed, expiring, and rejected when tampered with", async () => {
  const exp = NOW().getTime() + 1000;
  const value = await signSession(SECRET, { ...TEACHER, exp });
  assert.deepEqual(await verifySession(SECRET, value, NOW().getTime()), { ...TEACHER, exp });
  assert.equal(await verifySession(SECRET, value, exp + 1), null);
  assert.equal(await verifySession("t".repeat(40), value, NOW().getTime()), null);
  const [payload, mac] = value.split(".");
  const forged = Buffer.from(JSON.stringify({ ...TEACHER, id: "someone-else", exp })).toString("base64url");
  assert.equal(await verifySession(SECRET, `${forged}.${mac}`, NOW().getTime()), null);
  assert.equal(await verifySession(SECRET, `${payload}.${mac}x`, NOW().getTime()), null);
  assert.equal(await verifySession(SECRET, `${payload}.${mac}.extra`, NOW().getTime()), null);
  assert.equal(await verifySession(SECRET, null, NOW().getTime()), null);
});

test("sign-in links only point at trusted hosts, never a forged one", () => {
  const env = { NEXT_PUBLIC_SITE_URL: "shape-models.com", VERCEL_BRANCH_URL: "shape-git-x.vercel.app" };
  assert.equal(linkOrigin("https://shape-models.com/api/teach/sign-in", env), "https://shape-models.com");
  assert.equal(linkOrigin("https://shape-git-x.vercel.app/api/teach/sign-in", env), "https://shape-git-x.vercel.app");
  assert.equal(linkOrigin("http://localhost:3000/api/teach/sign-in", env), "http://localhost:3000");
  assert.equal(linkOrigin("https://evil.example/api/teach/sign-in", env), "https://shape-models.com");
  assert.equal(linkOrigin("https://evil.example/api/teach/sign-in", {}), "https://shape-models.com");
});

test("a class's experiment: design only, no runs, hypothesis locked", () => {
  const e = { ...experiment(), runs: [{ id: "r" } as never], forkedFrom: { slug: "x", manifestHash: "y" } };
  const c = classExperiment(e, 123);
  assert.deepEqual(c.runs, []);
  assert.equal(c.hypothesisLockedAt, 123);
  assert.equal(c.forkedFrom, undefined);
  assert.equal(classExperiment({ ...e, hypothesisLockedAt: 5 }, 123).hypothesisLockedAt, 5);
});

// --- Teacher sign-in ---------------------------------------------------------------------

test("sign-in: an approved email gets a one-time link; the database sees only its hash", async () => {
  const { rpc, calls } = fakeRpc({ request_teacher_login: { send: true } });
  const mail = fakeMailer();
  const res = await createSignInHandler({ config: ON, rpc, send: mail.send, now: NOW, env: { NEXT_PUBLIC_SITE_URL: "shape-models.com" } })(
    req("POST", "/api/teach/sign-in", { email: " Prof@Uni.edu " }),
  );
  assert.equal(res.status, 200);
  assert.equal(mail.sent.length, 1);
  assert.equal(mail.sent[0].to, "prof@uni.edu");
  const token = mail.sent[0].text.match(/token=([0-9a-f]{64})/)?.[1];
  assert.ok(token && isToken(token, 32));
  assert.match(mail.sent[0].text, /^Sign in to Shape as a teacher:\n\nhttps:\/\/shape-models\.com\/teach\/confirm\?token=/);
  assert.equal(calls[0].args.p_email, "prof@uni.edu");
  assert.equal(calls[0].args.p_token_hash, await sha256Hex(token!));
  assert.equal(calls[0].args.p_expires_at, "2026-10-05T12:15:00.000Z");
});

test("sign-in: unknown and throttled addresses get the same answer and no email", async () => {
  for (const reason of ["not_allowed", "throttled"]) {
    const mail = fakeMailer();
    const res = await createSignInHandler({ config: ON, rpc: fakeRpc({ request_teacher_login: { send: false, reason } }).rpc, send: mail.send, now: NOW })(
      req("POST", "/api/teach/sign-in", { email: "stranger@x.com" }),
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(mail.sent.length, 0);
  }
});

test("sign-in: refused when off, cross-origin, or malformed; a mail failure is a 503", async () => {
  const mail = fakeMailer();
  assert.equal((await createSignInHandler({ config: OFF, rpc: null })(req("POST", "/api/teach/sign-in", { email: "a@b.co" }))).status, 503);
  const h = createSignInHandler({ config: ON, rpc: fakeRpc({ request_teacher_login: { send: true } }).rpc, send: mail.send, now: NOW });
  assert.equal((await h(req("POST", "/api/teach/sign-in", { email: "a@b.co" }, { origin: "https://evil.example" }))).status, 403);
  assert.equal((await h(req("POST", "/api/teach/sign-in", { email: "nope" }))).status, 400);
  const failing = createSignInHandler({
    config: ON,
    rpc: fakeRpc({ request_teacher_login: { send: true } }).rpc,
    send: async () => {
      throw new Error("Resend 500");
    },
    now: NOW,
  });
  assert.equal((await failing(req("POST", "/api/teach/sign-in", { email: "a@b.co" }))).status, 503);
});

test("confirm: a good token sets a signed session cookie; a spent one doesn't", async () => {
  const token = "a".repeat(64);
  const { rpc, calls } = fakeRpc({ verify_teacher_login: (a: Record<string, unknown>) => (a.p_token_hash ? TEACHER : null) });
  const res = await createConfirmHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/teach/confirm", { token }));
  assert.equal(res.status, 200);
  assert.equal(calls[0].args.p_token_hash, await sha256Hex(token));
  const cookie = res.headers.get("set-cookie")!;
  assert.match(cookie, /^shape_teacher=.+; Path=\/; Max-Age=2592000; HttpOnly; SameSite=Lax; Secure$/);
  const value = decodeURIComponent(cookie.split(";")[0].split("=").slice(1).join("="));
  assert.equal((await verifySession(SECRET, value, NOW().getTime()))?.email, TEACHER.email);

  const spent = await createConfirmHandler({ config: ON, rpc: fakeRpc({ verify_teacher_login: null }).rpc, now: NOW })(req("POST", "/api/teach/confirm", { token }));
  assert.equal(spent.status, 400);
  assert.equal(spent.headers.get("set-cookie"), null);
  const junk = await createConfirmHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/teach/confirm", { token: "../../x" }));
  assert.equal(junk.status, 400);
});

test("sessions are re-checked against the allowlist; sign-out clears the cookie", async () => {
  const cookie = await teacherCookie();
  const value = decodeURIComponent(cookie.split("=").slice(1).join("="));
  assert.deepEqual(await currentTeacher({ config: ON, rpc: fakeRpc({ get_teacher: TEACHER }).rpc, now: NOW }, value), TEACHER);
  // Removed from the allowlist: get_teacher returns null, and so does the session.
  assert.equal(await currentTeacher({ config: ON, rpc: fakeRpc({ get_teacher: null }).rpc, now: NOW }, value), null);
  assert.equal(await currentTeacher({ config: ON, rpc: fakeRpc({ get_teacher: TEACHER }).rpc, now: NOW }, "forged.value"), null);

  const me = await createMeHandler({ config: ON, rpc: fakeRpc({ get_teacher: TEACHER }).rpc, now: NOW })(req("GET", "/api/teach/me", undefined, { cookie }));
  assert.deepEqual(await me.json(), { enabled: true, teacher: { email: TEACHER.email } });
  assert.deepEqual(await (await createMeHandler({ config: OFF, rpc: null })(req("GET", "/api/teach/me"))).json(), { enabled: false, teacher: null });

  const out = signOut(req("POST", "/api/teach/sign-out"));
  assert.match(out.headers.get("set-cookie")!, /^shape_teacher=; Path=\/; Max-Age=0/);
});

// --- Classes and members ----------------------------------------------------------------------

test("make a class: teacher only; stores a locked, run-free copy; retries a taken code", async () => {
  const anon = await createClassHandler({ config: ON, rpc: fakeRpc({ get_teacher: TEACHER }).rpc, now: NOW })(
    req("POST", "/api/classes", { experiment: experiment(), title: "Week 3" }),
  );
  assert.equal(anon.status, 401);

  let attempts = 0;
  const { rpc, calls } = fakeRpc({
    get_teacher: TEACHER,
    create_class: (a: Record<string, unknown>) => (++attempts === 1 ? { ok: false, reason: "code_taken" } : { ok: true, code: a.p_code }),
  });
  const withRuns = { ...experiment(), runs: [{ id: "r", conditionId: experiment().conditions[0].id, itemId: null, index: 0, status: "done", text: "x", requestedModel: "m", scores: {} }] };
  const res = await createClassHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/classes", { experiment: withRuns, title: " Week 3 " }, { cookie: await teacherCookie() }));
  assert.equal(res.status, 201);
  const body = await res.json();
  const creates = calls.filter((c) => c.fn === "create_class");
  assert.equal(creates.length, 2);
  assert.notEqual(creates[0].args.p_code, creates[1].args.p_code);
  assert.equal(body.code, creates[1].args.p_code);
  assert.equal(body.display, formatJoinCode(body.code));
  const stored = creates[1].args.p_experiment as Experiment;
  assert.deepEqual(stored.runs, []);
  assert.equal(stored.title, "Week 3");
  assert.ok(stored.hypothesisLockedAt);
  assert.equal(creates[1].args.p_teacher_id, TEACHER.id);
  assert.equal(creates[1].args.p_daily_calls, 3000);

  const noTitle = await createClassHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/classes", { experiment: experiment(), title: "" }, { cookie: await teacherCookie() }));
  assert.equal(noTitle.status, 400);
});

test("join: sets a per-class member cookie; the database sees only its hash; clear refusals", async () => {
  const { rpc, calls } = fakeRpc({ join_class: { ok: true } });
  const res = await createJoinHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/classes/kq7-m3p/join", { nickname: " Ada " }), "kq7-m3p");
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { nickname: "Ada" });
  const cookie = res.headers.get("set-cookie")!;
  assert.match(cookie, /^shape_class_KQ7M3P=[0-9a-f]{32}; Path=\/; Max-Age=15552000; HttpOnly; SameSite=Lax; Secure$/);
  const token = cookie.split(";")[0].split("=")[1];
  assert.deepEqual(calls[0].args, { p_code: "KQ7M3P", p_nickname: "Ada", p_token_hash: await sha256Hex(token) });

  const member = await currentMember({ config: ON, rpc: fakeRpc({ get_member: { nickname: "Ada", joined_at: "t" } }).rpc }, "KQ7M3P", token);
  assert.equal(member?.nickname, "Ada");
  assert.equal(await currentMember({ config: ON, rpc: fakeRpc({}).rpc }, "KQ7M3P", "not-a-token"), null);

  for (const [reason, status] of [["missing", 404], ["closed", 409], ["nickname_taken", 409]] as const) {
    const r = await createJoinHandler({ config: ON, rpc: fakeRpc({ join_class: { ok: false, reason } }).rpc, now: NOW })(
      req("POST", "/api/classes/KQ7M3P/join", { nickname: "Ada" }),
      "KQ7M3P",
    );
    assert.equal(r.status, status, reason);
    assert.equal(r.headers.get("set-cookie"), null);
  }
  const bad = await createJoinHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/classes/KQ7M3P/join", { nickname: "a@b.c" }), "KQ7M3P");
  assert.equal(bad.status, 400);
  const badCode = await createJoinHandler({ config: ON, rpc, now: NOW })(req("POST", "/api/classes/nope/join", { nickname: "Ada" }), "nope");
  assert.equal(badCode.status, 404);
});
