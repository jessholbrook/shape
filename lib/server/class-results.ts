import { isToken, normalizeJoinCode, TEACHER_COOKIE } from "../classroom";
import { toCsv, type ClassRunRow } from "../class-results";
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
