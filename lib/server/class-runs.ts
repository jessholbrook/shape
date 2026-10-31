import {
  composeClassifier,
  composeRater,
  parseClassifier,
  parseRating,
  resolveCall,
  scoreLocal,
  type Experiment,
  type ExperimentRun,
  type LabModel,
} from "../experiment";
import { PROVIDERS, type ProviderId } from "../providers";
import { periodKeys } from "../hosted";
import { sha256Hex } from "../sharing";
import { designFor, isToken, judgeCallId, memberCookieName, normalizeJoinCode, promptFingerprint, runCallId } from "../classroom";
export { designFor };
import { readCookie } from "./identity";
import { error, gate, json, readJson, type ClassDeps, type StudentClass } from "./classroom-handler";

/**
 * Running a class's experiment: what a student has left today, and saving
 * their runs to the class.
 *
 * The integrity rule lives here. A run on the free tier was answered through
 * Shape's server, which kept the answer and a fingerprint of the prompt. If
 * that record exists for exactly the class's prompt — and so does every
 * judge's reply — the run is stored as recorded by Shape: its text comes from
 * the record and every score is recomputed here. Anything else is stored as
 * reported by the student, with what their browser sent.
 */

const MAX_TEXT = 40_000;
const CALL_ID_RE = /^[A-Za-z0-9_:.-]{1,120}$/;

type Recorded = Record<string, { text: string; model: string; prompt_hash: string }>;

export type StoredRun = {
  run_id: string;
  condition_id: string;
  item_id: string | null;
  idx: number;
  provider: ProviderId;
  model: string;
  status: "done" | "error";
  text: string;
  error: string | null;
  scores: Record<string, boolean | number | null>;
  judge_raw: Record<string, string> | null;
  recorded: boolean;
  latency_ms: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
};

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : null);

export function validModel(v: unknown): LabModel | null {
  if (!isObj(v) || typeof v.provider !== "string" || typeof v.model !== "string" || !v.model.trim() || v.model.length > 200) return null;
  return v.provider in PROVIDERS ? { provider: v.provider as ProviderId, model: v.model } : null;
}

/** Shape-check submitted runs against the class's design. Says what's wrong. */
export function validateRuns(design: Experiment, runs: unknown): { ok: true; runs: ExperimentRun[] } | { ok: false; message: string } {
  if (!Array.isArray(runs)) return { ok: false, message: "Runs must be a list." };
  const cells = design.conditions.length * Math.max(1, design.items.length);
  if (runs.length === 0) return { ok: false, message: "No runs to submit." };
  if (runs.length > cells * design.n) return { ok: false, message: "More runs than this experiment has." };
  const conditions = new Set(design.conditions.map((c) => c.id));
  const items = new Set(design.items.map((i) => i.id));
  const ids = new Set<string>();
  for (const r of runs) {
    if (!isObj(r) || typeof r.id !== "string" || !CALL_ID_RE.test(r.id) || ids.has(r.id)) return { ok: false, message: "Invalid run id." };
    ids.add(r.id);
    if (typeof r.conditionId !== "string" || !conditions.has(r.conditionId)) return { ok: false, message: "A run refers to a condition this class doesn't have." };
    const itemOk = design.items.length === 0 ? r.itemId === null : typeof r.itemId === "string" && items.has(r.itemId);
    if (!itemOk) return { ok: false, message: "A run refers to an item this class doesn't have." };
    if (typeof r.index !== "number" || !Number.isInteger(r.index) || r.index < 0 || r.index >= design.n) return { ok: false, message: "Invalid run index." };
    if (r.status !== "done" && r.status !== "error") return { ok: false, message: "Only finished runs can be submitted." };
    if (typeof r.text !== "string" || !isObj(r.scores)) return { ok: false, message: "Invalid run." };
  }
  return { ok: true, runs: runs as ExperimentRun[] };
}

/** Every call id whose record could make one of these runs "recorded by Shape". */
export function callIdsToCheck(design: Experiment, runs: ExperimentRun[]): string[] {
  const ids: string[] = [];
  for (const r of runs) {
    if (r.status !== "done" || resolveCall(design, r.conditionId, r.itemId).provider !== "shape-free") continue;
    ids.push(runCallId(r.id));
    for (const m of design.measures) {
      if ((m.kind === "classify" || m.kind === "rate") && m.judge.provider === "shape-free") ids.push(judgeCallId(r.id, m.id));
    }
  }
  return ids;
}

/** What the student's browser said, cleaned: known measures only, scores as booleans, numbers or null. */
function reportedScores(design: Experiment, scores: Record<string, unknown>): Record<string, boolean | number | null> {
  const out: Record<string, boolean | number | null> = {};
  for (const m of design.measures) {
    const v = scores[m.id];
    out[m.id] = typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v)) ? v : null;
  }
  return out;
}

/** Decide, run by run, what gets stored — and whether Shape can vouch for it. */
export async function checkRuns(design: Experiment, runs: ExperimentRun[], recorded: Recorded): Promise<StoredRun[]> {
  const out: StoredRun[] = [];
  for (const r of runs) {
    const call = resolveCall(design, r.conditionId, r.itemId);
    const base = {
      run_id: r.id,
      condition_id: r.conditionId,
      item_id: r.itemId,
      idx: r.index,
      provider: call.provider,
      model: call.model,
      latency_ms: num(r.latencyMs),
      input_tokens: num(r.inputTokens),
      output_tokens: num(r.outputTokens),
    };
    if (r.status === "error") {
      out.push({ ...base, status: "error", text: "", error: String(r.error ?? "").slice(0, 500), scores: {}, judge_raw: null, recorded: false });
      continue;
    }

    const first = call.messages[0];
    const expected = await promptFingerprint({
      system: call.system,
      user: first && first.role === "user" ? first.content : "",
      temperature: call.temperature,
    });
    const answer = call.provider === "shape-free" ? recorded[runCallId(r.id)] : undefined;
    if (!answer || answer.prompt_hash !== expected) {
      const raw = isObj(r.judgeRaw) ? Object.fromEntries(Object.entries(r.judgeRaw).map(([k, v]) => [k, String(v).slice(0, 4000)])) : null;
      out.push({ ...base, status: "done", text: r.text.slice(0, MAX_TEXT), error: null, scores: reportedScores(design, r.scores), judge_raw: raw, recorded: false });
      continue;
    }

    // The answer is the server's. Score it here; take a judge's verdict only from its own record.
    const text = answer.text;
    const scores: Record<string, boolean | number | null> = {};
    const judgeRaw: Record<string, string> = {};
    let allRecorded = true;
    const client = reportedScores(design, r.scores);
    for (const m of design.measures) {
      if (m.kind !== "classify" && m.kind !== "rate") {
        scores[m.id] = scoreLocal(m, text);
        continue;
      }
      const prompt = m.kind === "classify" ? composeClassifier(m, text) : composeRater(m, text);
      const want = await promptFingerprint({ system: prompt.system, user: prompt.user, temperature: 0 });
      const reply = m.judge.provider === "shape-free" ? recorded[judgeCallId(r.id, m.id)] : undefined;
      if (reply && reply.prompt_hash === want) {
        judgeRaw[m.id] = reply.text;
        if (m.kind === "classify") {
          const label = parseClassifier(reply.text, m.labels);
          scores[m.id] = label === null ? null : label === m.target;
        } else {
          scores[m.id] = parseRating(reply.text, m.scale);
        }
      } else {
        allRecorded = false;
        scores[m.id] = client[m.id];
      }
    }
    out.push({
      ...base,
      status: "done",
      text,
      error: null,
      scores,
      judge_raw: Object.keys(judgeRaw).length ? judgeRaw : null,
      recorded: allRecorded,
    });
  }
  return out;
}

// --- Handlers ------------------------------------------------------------------------------

const OFF = "Classrooms aren't available right now.";

async function memberHash(req: Request, code: string): Promise<string | null> {
  const token = readCookie(req, memberCookieName(code));
  return isToken(token, 16) ? sha256Hex(token) : null;
}

/** POST /api/classes/<code>/runs {model, runs} — save a student's runs to the class (replacing their last set). */
export function createSubmitRunsHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function POST(req: Request, rawCode: string): Promise<Response> {
    if (!deps.config.enabled || !deps.rpc) return error(503, OFF);
    const blocked = gate(req, "class-runs", 20, 60 * 1000, now().getTime());
    if (blocked) return blocked;
    const code = normalizeJoinCode(rawCode);
    if (!code) return error(404, "No class has that code.");
    const hash = await memberHash(req, code);
    if (!hash) return error(403, "Join the class before submitting runs.");
    const parsed = await readJson(req, 3_000_000);
    if (!parsed.ok) return parsed.res;
    const model = validModel(parsed.body.model);
    if (!model) return error(400, "Unknown model.");

    try {
      const cls = await deps.rpc<StudentClass | null>("get_class", { p_code: code });
      if (!cls) return error(404, "No class has that code.");
      if (cls.status !== "open") return error(409, "This class is closed.");
      const design = designFor(cls.experiment, model);
      const v = validateRuns(design, parsed.body.runs);
      if (!v.ok) return error(400, v.message);

      const ids = callIdsToCheck(design, v.runs);
      const recorded = ids.length ? await deps.rpc<Recorded>("get_class_calls", { p_code: code, p_member_hash: hash, p_call_ids: ids }) : {};
      const rows = await checkRuns(design, v.runs, recorded ?? {});
      const r = await deps.rpc<{ ok: boolean; reason?: string; stored?: number }>("submit_class_runs", {
        p_code: code,
        p_member_hash: hash,
        p_runs: rows,
      });
      if (!r.ok) return r.reason === "closed" ? error(409, "This class is closed.") : error(403, "Join the class before submitting runs.");
      return json(200, { stored: r.stored ?? rows.length, recorded: rows.filter((x) => x.recorded).length });
    } catch (err) {
      console.error("classroom: submitting runs failed", err instanceof Error ? err.message : err);
      return error(503, "Couldn't save your runs to the class right now. They're still here — try again in a minute.");
    }
  };
}

/** GET /api/classes/<code>/status — what this student has left today, for the preflight. */
export function createClassStatusHandler(deps: ClassDeps) {
  const now = deps.now ?? (() => new Date());
  return async function GET(req: Request, rawCode: string): Promise<Response> {
    const off = { freeTier: false, status: null, classRemaining: 0, memberRemaining: 0 };
    if (!deps.config.enabled || !deps.rpc) return json(200, off);
    const code = normalizeJoinCode(rawCode);
    const hash = code ? await memberHash(req, code) : null;
    if (!code || !hash) return json(200, off);
    if (!deps.freeTier || !deps.memberDailyCalls) return json(200, { ...off, status: "open" });
    try {
      const s = await deps.rpc<{ status: string; class_remaining: number; member_remaining: number } | null>("class_quota_status", {
        p_code: code,
        p_member_hash: hash,
        p_day: periodKeys(now()).day,
        p_member_limit: deps.memberDailyCalls,
      });
      if (!s) return json(200, off);
      return json(200, { freeTier: true, status: s.status, classRemaining: s.class_remaining, memberRemaining: s.member_remaining });
    } catch (err) {
      console.error("classroom: status failed", err instanceof Error ? err.message : err);
      return json(200, off);
    }
  };
}
