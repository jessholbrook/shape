/**
 * Classrooms, part 3: pooled results, closing a class, and the teacher's
 * export. Pure logic and handlers against fakes — no network, no database.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { starterExperiment } from "../lib/experiment";
import { readClassConfig, signSession, TEACHER_COOKIE, type ClassConfig } from "../lib/classroom";
import { ALL, csvCell, defaultFilter, filterRows, modelsIn, pooled, studentsIn, toCsv, type ClassRunRow } from "../lib/class-results";
import { createExportHandler, createSetStatusHandler, loadClassResults } from "../lib/server/class-results";
import { sha256Hex } from "../lib/sharing";
import type { Rpc } from "../lib/server/supabase";

const SECRET = "s".repeat(40);
const ON = readClassConfig({
  SHAPE_CLASSROOMS: "on",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "sb_secret_test",
  CLASSROOM_SESSION_SECRET: SECRET,
  RESEND_API_KEY: "re_test",
  EMAIL_FROM: "Shape <hello@shape-models.com>",
}) as Extract<ClassConfig, { enabled: true }>;
const ORIGIN = "https://shape-models.com";
const NOW = () => new Date("2026-11-02T12:00:00Z");
const TEACHER = { id: "11111111-1111-1111-1111-111111111111", email: "prof@uni.edu" };
const E = starterExperiment({ provider: "shape-free", model: "claude-haiku-4-5" }, 1);
const [C0, C1] = E.conditions.map((c) => c.id);
const ENDORSES = "m_endorses";
const LENGTH = "m_length";

let ip = 0;
function req(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(`${ORIGIN}${path}`, {
    method,
    headers: { origin: ORIGIN, "content-type": "application/json", "x-forwarded-for": `198.51.100.${++ip}`, ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function fakeRpc(answers: Record<string, unknown>) {
  const calls: { fn: string; args: Record<string, unknown> }[] = [];
  const rpc: Rpc = async <T,>(fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const a = answers[fn];
    if (a instanceof Error) throw a;
    return a as T;
  };
  return { rpc, calls };
}

async function teacherCookie() {
  return `${TEACHER_COOKIE}=${encodeURIComponent(await signSession(SECRET, { ...TEACHER, exp: NOW().getTime() + 60_000 }))}`;
}

function row(over: Partial<ClassRunRow>): ClassRunRow {
  return {
    run_id: "r",
    condition_id: C0,
    item_id: null,
    idx: 0,
    provider: "shape-free",
    model: "claude-haiku-4-5",
    status: "done",
    scores: { [ENDORSES]: true, [LENGTH]: 40 },
    recorded: true,
    text: "an answer",
    ...over,
  };
}

// --- Pooling ---------------------------------------------------------------------------

test("the view starts on the most-run model, never on a mix of models", () => {
  const rows = [
    row({ run_id: "a" }),
    row({ run_id: "b", provider: "anthropic", model: "claude-sonnet-5-5", recorded: false }),
    row({ run_id: "c" }),
  ];
  assert.deepEqual(modelsIn(rows), [
    { key: "shape-free/claude-haiku-4-5", runs: 2, recorded: 2 },
    { key: "anthropic/claude-sonnet-5-5", runs: 1, recorded: 0 },
  ]);
  assert.deepEqual(defaultFilter(rows), { model: "shape-free/claude-haiku-4-5", source: "all", student: ALL });
  assert.deepEqual(defaultFilter([]), { model: ALL, source: "all", student: ALL });
});

test("filters narrow by model, by recorded-only, and by student", () => {
  const rows = [
    row({ run_id: "a", nickname: "Ada" }),
    row({ run_id: "b", nickname: "Ada", recorded: false }),
    row({ run_id: "c", nickname: "Bo", provider: "openai", model: "gpt-5" }),
  ];
  const ids = (f: Parameters<typeof filterRows>[1]) => filterRows(rows, f).map((r) => r.run_id);
  assert.deepEqual(ids({ model: ALL, source: "all", student: ALL }), ["a", "b", "c"]);
  assert.deepEqual(ids({ model: "shape-free/claude-haiku-4-5", source: "all", student: ALL }), ["a", "b"]);
  assert.deepEqual(ids({ model: ALL, source: "recorded", student: ALL }), ["a", "c"]);
  assert.deepEqual(ids({ model: ALL, source: "all", student: "Bo" }), ["c"]);
  assert.deepEqual(studentsIn(rows), ["Ada", "Bo"]);
});

test("pooled runs analyse like one lab run; a hidden answer counts its scores but not as empty text", () => {
  const rows = [
    row({ run_id: "a", condition_id: C0, scores: { [ENDORSES]: true }, text: "yes it is good" }),
    row({ run_id: "a", condition_id: C0, idx: 1, scores: { [ENDORSES]: true }, text: "yes it is good" }),
    // Same run id from another student: still two runs.
    row({ run_id: "b", condition_id: C1, scores: { [ENDORSES]: false }, recorded: false, text: null }),
    row({ run_id: "c", condition_id: C1, scores: { [ENDORSES]: false }, text: "no" }),
  ];
  const { experiment, analysis } = pooled(E, rows);
  assert.equal(new Set(experiment.runs.map((r) => r.id)).size, 4, "ids stay unique across students");
  const cell = (c: string) => analysis.cells.find((x) => x.conditionId === c && x.measureId === ENDORSES)!;
  assert.equal(cell(C0).n, 2);
  assert.equal(cell(C1).n, 2, "the reported run's score counts");
  const v = analysis.variance.find((x) => x.conditionId === C1)!;
  assert.equal(v.n, 1, "variance only over answers the viewer can see");
});

// --- Export ------------------------------------------------------------------------------

test("CSV cells: quoted, and a spreadsheet formula typed by a student is defused", () => {
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("=HYPERLINK(\"http://x\")"), "\"'=HYPERLINK(\"\"http://x\"\")\"");
  for (const lead of ["+", "-", "@", "\t", "\r"]) assert.ok(csvCell(`${lead}1`).startsWith(`"'`), `defuses ${JSON.stringify(lead)}`);
  assert.equal(csvCell(-1), "-1", "a real number stays a number");
  assert.equal(csvCell(true), "true");
  assert.equal(csvCell(null), "");
});

test("the CSV has one row per run, every measure as a column, and says which runs Shape recorded", () => {
  const csv = toCsv(E, [
    row({ nickname: "Ada", item_id: E.items[0].id, idx: 2, text: "line one\nline two" }),
    row({ nickname: "=cmd", recorded: false, condition_id: C1, scores: { [ENDORSES]: null } }),
  ]);
  assert.ok(csv.startsWith("﻿"), "byte-order mark for spreadsheet apps");
  const lines = csv.slice(1).split("\r\n");
  const header = lines[0];
  for (const m of E.measures) assert.ok(header.includes(`"${m.label}"`));
  assert.ok(lines[1].startsWith(`"Ada","${E.conditions[0].label}","${E.items[0].label}",3,`));
  assert.ok(lines[1].includes('"recorded by Shape"'));
  assert.ok(lines[1].includes('"line one\nline two"'), "a multi-line answer stays one quoted cell");
  assert.ok(lines.at(-2)!.startsWith(`"'=cmd"`));
  assert.ok(lines.at(-2)!.includes('"reported by student"'));
});

// --- Handlers ----------------------------------------------------------------------------

test("a member's results are looked up by their cookie's hash; no cookie, no lookup", async () => {
  const token = "ab".repeat(16);
  const { rpc, calls } = fakeRpc({ get_class_results: [row({})] });
  const r = await loadClassResults({ config: ON, rpc }, "kq7-m3p", token);
  assert.equal(r.status, "ok");
  assert.deepEqual(calls[0], { fn: "get_class_results", args: { p_code: "KQ7M3P", p_member_hash: await sha256Hex(token) } });
  assert.equal((await loadClassResults({ config: ON, rpc }, "KQ7M3P", null)).status, "missing");
  assert.equal(calls.length, 1);
});

test("closing a class: the teacher's own, same-origin, open or closed only", async () => {
  const cookie = await teacherCookie();
  const ok = fakeRpc({ get_teacher: TEACHER, set_class_status: { status: "closed", closed_at: "2026-11-02T12:00:00Z" } });
  const h = createSetStatusHandler({ config: ON, rpc: ok.rpc, now: NOW });
  const res = await h(req("POST", "/api/teach/classes/KQ7M3P/status", { status: "closed" }, { cookie }), "kq7m3p");
  assert.equal(res.status, 200);
  assert.deepEqual(ok.calls.at(-1), { fn: "set_class_status", args: { p_teacher_id: TEACHER.id, p_code: "KQ7M3P", p_status: "closed" } });

  assert.equal((await h(req("POST", "/x", { status: "closed" }), "KQ7M3P")).status, 401, "no teacher");
  assert.equal((await h(req("POST", "/x", { status: "closed" }, { cookie, origin: "https://evil.example" }), "KQ7M3P")).status, 403);
  assert.equal((await h(req("POST", "/x", { status: "deleted" }, { cookie }), "KQ7M3P")).status, 400);
  const notTheirs = createSetStatusHandler({ config: ON, rpc: fakeRpc({ get_teacher: TEACHER, set_class_status: null }).rpc, now: NOW });
  assert.equal((await notTheirs(req("POST", "/x", { status: "closed" }, { cookie }), "KQ7M3P")).status, 404);
});

test("export: the teacher's class as a CSV or JSON download; anyone else gets nothing", async () => {
  const cookie = await teacherCookie();
  const cls = { id: "c1", code: "KQ7M3P", title: "Week 3: Sycophancy", status: "open", experiment: E, daily_calls: 3000, created_at: "x", closed_at: null, members: [] };
  const runs = [row({ nickname: "Ada" })];
  const deps = { config: ON, rpc: fakeRpc({ get_teacher: TEACHER, get_teacher_class: cls, get_teacher_class_runs: runs }).rpc, now: NOW };
  const get = (q: string, headers: Record<string, string> = { cookie }) =>
    createExportHandler(deps)(req("GET", `/api/teach/classes/KQ7M3P/export${q}`, undefined, headers), "KQ7M3P");

  const csv = await get("");
  assert.equal(csv.status, 200);
  assert.match(csv.headers.get("content-type")!, /^text\/csv/);
  assert.equal(csv.headers.get("content-disposition"), 'attachment; filename="shape-class-KQ7M3P-week-3-sycophancy.csv"');
  assert.match(await csv.text(), /"Ada"/);

  const j = await get("?format=json");
  const body = await j.json();
  assert.deepEqual(Object.keys(body), ["exportedAt", "class", "experiment", "runs"]);
  assert.equal(body.runs[0].nickname, "Ada");
  assert.equal(body.experiment.id, E.id, "the design travels with the data, for replication");

  assert.equal((await get("", {})).status, 401);
  const none = { config: ON, rpc: fakeRpc({ get_teacher: TEACHER, get_teacher_class: null, get_teacher_class_runs: null }).rpc, now: NOW };
  assert.equal((await createExportHandler(none)(req("GET", "/x", undefined, { cookie }), "KQ7M3P")).status, 404);
});
