import { isToken, memberCookieName, normalizeJoinCode, TEACHER_COOKIE } from "../classroom";
import { answersOf, classSnapshot, toCsv, type ClassRunRow } from "../class-results";
import { buildManifest, manifestHash, ranAtOf } from "../experiment";
import { periodKeys } from "../hosted";
import { isSlug, newDeleteToken, newSlug } from "../sharing";
import { slugify } from "../download";
import { clientIp, rateLimit, tooManyRequests } from "../api-guard";
import { sha256Hex } from "../sharing";
import { readCookie } from "./identity";
import { currentTeacher, error, gate, json, loadTeacherClass, readJson, type ClassDeps, type Load, type Teacher } from "./classroom-handler";

/**
 * Classrooms, part 3: the class's pooled results, closing a class, and the
 * teacher's export. Who sees what is decided in the database
 * (20261102000000_class_results.sql): members get anonymous rows with
 * classmates' reported answers hidden; the teacher gets everything by name.
 */

const OFF = "Classrooms aren't available right now.";

async function loadRows(deps: ClassDeps, fn: string, args: Record<string, unknown>): Promise<Load<ClassRunRow[]>> {
  if (!deps.config.enabled || !deps.rpc) return { status: "unavailable" };
  try {
    const rows = await deps.rpc<ClassRunRow[] | null>(fn, args);
    return rows ? { status: "ok", data: rows } : { status: "missing" };
  } catch (err) {
    console.error(`classroom: ${fn} failed`, err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
}

/** The class's runs for a member, by their cookie. Missing if they aren't one. */
export async function loadClassResults(deps: ClassDeps, rawCode: string, cookieValue: string | null): Promise<Load<ClassRunRow[]>> {
  const code = normalizeJoinCode(rawCode);
  if (!code || !isToken(cookieValue, 16)) return { status: "missing" };
  return loadRows(deps, "get_class_results", { p_code: code, p_member_hash: await sha256Hex(cookieValue) });
}

/** Every run in the teacher's own class, with nicknames. */
export function loadTeacherRuns(deps: ClassDeps, teacher: Teacher, rawCode: string): Promise<Load<ClassRunRow[]>> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return Promise.resolve({ status: "missing" });
  return loadRows(deps, "get_teacher_class_runs", { p_teacher_id: teacher.id, p_code: code });
}

/**
 * The answers behind a page's light rows (lightenRows), in the same order:
 * text and judge replies only, for whoever may see them. A member gets the
 * same view as get_class_results gives them; the teacher gets everything.
 * Fetched when someone opens the run list.
 */
function answersResponse(load: Load<ClassRunRow[]>): Response {
  if (load.status === "missing") return error(404, "No class you're in has that code.");
  if (load.status !== "ok") return error(503, "Couldn't load the answers right now. Try again in a minute.");
  return json(200, { answers: answersOf(load.data) }, { "cache-control": "no-store" });
}

/** GET /api/classes/<code>/runs — a member's view of the class's answers. */
export function createStudentAnswersHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function GET(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const limited = rateLimit(`class-answers:${clientIp(req)}`, 120, 60 * 60 * 1000, now().getTime());
    if (!limited.ok) return tooManyRequests(limited.retryAfter);
    const code = normalizeJoinCode(rawCode);
    if (!code) return error(404, "No class has that code.");
    return answersResponse(await loadClassResults(deps, code, readCookie(req, memberCookieName(code))));
  };
}

/** GET /api/teach/classes/<code>/answers — every answer in the teacher's class. */
export function createTeacherAnswersHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function GET(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const limited = rateLimit(`class-answers:${clientIp(req)}`, 120, 60 * 60 * 1000, now().getTime());
    if (!limited.ok) return tooManyRequests(limited.retryAfter);
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    return answersResponse(await loadTeacherRuns(deps, teacher, rawCode));
  };
}

/** POST /api/teach/classes/<code>/status {status: "open" | "closed"} — the teacher closes or reopens their class. */
export function createSetStatusHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "class-status", 30, 60 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    const code = normalizeJoinCode(rawCode);
    if (!code) return error(404, "No class has that code.");
    const parsed = await readJson(req, 1_000);
    if (!parsed.ok) return parsed.res;
    const status = parsed.body.status;
    if (status !== "open" && status !== "closed") return error(400, 'Status must be "open" or "closed".');
    try {
      const r = await deps.rpc<{ status: string; closed_at: string | null } | null>("set_class_status", {
        p_teacher_id: teacher.id,
        p_code: code,
        p_status: status,
      });
      return r ? json(200, r) : error(404, "No class of yours has that code.");
    } catch (err) {
      console.error("classroom: set status failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't change the class right now. Try again in a minute.");
    }
  };
}

/**
 * GET /api/teach/classes/<code>/export?format=csv|json — every run, for the
 * teacher. A plain link (no Origin header), so it's guarded by the teacher's
 * cookie and a rate limit rather than the same-origin check; the cookie is
 * SameSite=Lax and the response is a download no other site can read.
 */
export function createExportHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function GET(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const limited = rateLimit(`class-export:${clientIp(req)}`, 30, 60 * 60 * 1000, now().getTime());
    if (!limited.ok) return tooManyRequests(limited.retryAfter);
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    const format = new URL(req.url).searchParams.get("format") === "json" ? "json" : "csv";

    const [cls, runs] = await Promise.all([loadTeacherClass(deps, teacher, rawCode), loadTeacherRuns(deps, teacher, rawCode)]);
    if (cls.status === "missing" || runs.status === "missing") return error(404, "No class of yours has that code.");
    if (cls.status !== "ok" || runs.status !== "ok") return error(503, "Couldn't load the class right now. Try again in a minute.");

    const c = cls.data;
    const name = `shape-class-${c.code}-${slugify(c.title, "results")}`;
    const headers = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
    if (format === "json") {
      const body = {
        exportedAt: now().toISOString(),
        class: { code: c.code, title: c.title, status: c.status, createdAt: c.created_at, closedAt: c.closed_at },
        experiment: c.experiment,
        runs: runs.data,
      };
      return new Response(JSON.stringify(body, null, 2), {
        headers: { ...headers, "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="${name}.json"` },
      });
    }
    return new Response(toCsv(c.experiment, runs.data), {
      headers: { ...headers, "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="${name}.csv"` },
    });
  };
}

// --- Publishing ---------------------------------------------------------------------------

export type Publication = { slug: string; title: string; model: string | null; runs: number; created_at: string };

/** The teacher's published results for a class, newest first. */
export async function loadClassPublications(deps: ClassDeps, teacher: Teacher, rawCode: string): Promise<Load<Publication[]>> {
  const code = normalizeJoinCode(rawCode);
  if (!code) return { status: "missing" };
  if (!deps.config.enabled || !deps.rpc) return { status: "unavailable" };
  try {
    const rows = await deps.rpc<Publication[] | null>("list_class_publications", { p_teacher_id: teacher.id, p_code: code });
    return rows ? { status: "ok", data: rows } : { status: "missing" };
  } catch (err) {
    console.error("classroom: list publications failed", err instanceof Error ? err.message : err);
    return { status: "unavailable" };
  }
}

const SHARING_OFF = "Publishing needs sharing, which is switched off right now.";

/**
 * POST /api/teach/classes/<code>/publish {model} — publish the class's results
 * for one model as an unlisted shared page. The snapshot is built here from
 * the class's records (classSnapshot): recorded runs only, no nicknames.
 */
export function createPublishClassHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    if (!deps.sharing?.enabled) return error(503, SHARING_OFF);
    const blocked = gate(req, "class-publish", 10, 60 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    const code = normalizeJoinCode(rawCode);
    if (!code) return error(404, "No class has that code.");
    const parsed = await readJson(req, 1_000);
    if (!parsed.ok) return parsed.res;
    const model = typeof parsed.body.model === "string" ? parsed.body.model : "";

    const [cls, runs] = await Promise.all([loadTeacherClass(deps, teacher, code), loadTeacherRuns(deps, teacher, code)]);
    if (cls.status === "missing" || runs.status === "missing") return error(404, "No class of yours has that code.");
    if (cls.status !== "ok" || runs.status !== "ok") return error(503, "Couldn't load the class right now. Try again in a minute.");

    const snap = classSnapshot(cls.data, runs.data, model, now().getTime());
    if (!snap.ok) return error(400, snap.message);
    const experiment = snap.experiment;
    const manifest = buildManifest(experiment, { appVersion: deps.appVersion ?? "local", ranAt: ranAtOf(experiment), runner: "hosted" });
    const slug = newSlug(deps.random);
    try {
      const r = await deps.rpc<{ ok: boolean; reason?: string } | null>("publish_class_results", {
        p_teacher_id: teacher.id,
        p_code: code,
        p_slug: slug,
        p_title: experiment.title,
        p_lens: experiment.lens ?? null,
        p_experiment: experiment,
        p_manifest: manifest,
        p_hash: await manifestHash(manifest),
        // Taken down from the class page by the teacher, so the token itself is never needed.
        p_delete_hash: await sha256Hex(newDeleteToken(deps.random)),
        p_day: periodKeys(now()).day,
        p_limit: deps.sharing.dailyPublishes,
      });
      if (!r) return error(404, "No class of yours has that code.");
      if (!r.ok) return error(429, `You've published ${deps.sharing.dailyPublishes} results today, the daily limit. Try again tomorrow.`);
      return json(201, { slug, runs: experiment.runs.length, students: experiment.classPool?.students ?? 0 });
    } catch (err) {
      console.error("classroom: publish failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't publish right now. Try again in a minute.");
    }
  };
}

/** DELETE /api/teach/classes/<code>/publications/<slug> — take a published result down. */
export function createUnpublishClassHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function DELETE(req: Request, rawCode: string, slug: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "class-unpublish", 30, 60 * 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const teacher = await currentTeacher(deps, readCookie(req, TEACHER_COOKIE));
    if (!teacher) return error(401, "Sign in as a teacher first.");
    const code = normalizeJoinCode(rawCode);
    if (!code || !isSlug(slug)) return error(404, "No such published result.");
    try {
      const gone = await deps.rpc<boolean>("unpublish_class_results", { p_teacher_id: teacher.id, p_code: code, p_slug: slug });
      return gone ? new Response(null, { status: 204 }) : error(404, "No such published result, or it's already gone.");
    } catch (err) {
      console.error("classroom: unpublish failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't take it down right now. Try again in a minute.");
    }
  };
}
