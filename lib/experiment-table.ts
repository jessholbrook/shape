import type { Condition, Experiment, ExperimentRun, Measure } from "./experiment";
import {
  MAX_ROUNDS,
  MAX_SEATS,
  MIN_SEATS,
  buildRoundtableReport,
  callsFor,
  composeSeatSystem,
  estimateRoundtableCost,
  type CheckId,
  type Protocol,
  type RoundtableReport,
  type Seat,
  type StopReason,
  type Task,
  type Turn,
} from "./roundtable";

/**
 * Round Table experiments: the Lab's repeated runs, where one run is a whole
 * table session instead of one model call.
 *
 * The seats and the decision are fixed by the experiment; conditions change
 * only the protocol (blind or open first round, side-notes, when to stop, who
 * speaks first) — the lesson's point is to change the room, not the prompts.
 * Measures read each finished table with the same report the playground uses,
 * so "planted dissenter held" means exactly what it means there. No model is
 * asked what happened.
 *
 * Pure: no network, no storage, no React.
 */

export type TableSetup = {
  seats: Seat[];
  task: Task;
  protocol: Protocol;
  temperature: number;
};

/** The report's checks, plus three readings of the outcome. */
export type TableCheck = CheckId | "reached-consensus" | "consensus-round" | "seats-moved";

export const TABLE_CHECKS: Record<TableCheck, { label: string; binary: boolean; describe: string }> = {
  "planted-held": {
    label: "planted seat held",
    binary: true,
    describe: "The seat planted to disagree ended on the stance it was planted to hold.",
  },
  "dissent-survived": {
    label: "dissent survived",
    binary: true,
    describe: "Someone still disagreed when the table stopped.",
  },
  "not-anchored": {
    label: "not anchored on the opener",
    binary: true,
    describe: "When the table agreed, it wasn't simply on the first speaker's opening position. Tables with no consensus aren't counted.",
  },
  "no-move-after-note": {
    label: "nobody moved after a side-note",
    binary: true,
    describe: "No seat changed position after receiving a private note. Counts only tables where side-notes are on and a note was passed.",
  },
  "clear-stances": {
    label: "every turn gave a stance",
    binary: true,
    describe: "Every turn ended with a readable STANCE line. When this fails, the other checks are reading a partial room.",
  },
  "reached-consensus": {
    label: "reached consensus",
    binary: true,
    describe: "Every seat ended on the same position, for or against.",
  },
  "consensus-round": {
    label: "round consensus was reached",
    binary: false,
    describe: "The first round that ended in agreement. Tables that never agreed aren't counted.",
  },
  "seats-moved": {
    label: "seats that changed position",
    binary: false,
    describe: "How many seats ended somewhere other than where they opened.",
  },
};

export const TABLE_CHECK_IDS = Object.keys(TABLE_CHECKS) as TableCheck[];
export const isTableCheck = (v: unknown): v is TableCheck => typeof v === "string" && v in TABLE_CHECKS;

/** Default runs per condition for a table: each run is a whole table, so ten is already a lot of calls. */
export const TABLE_DEFAULT_N = 10;

// --- One condition's table ----------------------------------------------------------

/**
 * The table a condition runs: the base setup with the condition's protocol
 * changes applied, and — when it names a first speaker — that seat moved to
 * the front, the rest keeping their order.
 */
export function tableFor(e: Pick<Experiment, "table" | "conditions">, conditionId: string): TableSetup {
  if (!e.table) throw new Error("Not a Round Table experiment.");
  const condition = e.conditions.find((c) => c.id === conditionId);
  if (!condition) throw new Error(`Unknown condition "${conditionId}"`);
  const p = condition.patch;
  const protocol: Protocol = { ...e.table.protocol, ...(p.protocol ?? {}) };
  let seats = e.table.seats;
  if (p.firstSpeaker) {
    const first = seats.find((s) => s.id === p.firstSpeaker);
    if (first) seats = [first, ...seats.filter((s) => s.id !== first.id)];
  }
  return { seats, task: e.table.task, protocol, temperature: p.temperature ?? e.table.temperature };
}

/** Model calls one table makes in this condition if nothing stops it early. */
export function tableCallsFor(e: Pick<Experiment, "table" | "conditions">, conditionId: string): number {
  const t = tableFor(e, conditionId);
  return callsFor(t.seats, t.protocol);
}

/** The models seated at a table, for the run's "requested model" field. */
export function tableModels(seats: Seat[]): string {
  return [...new Set(seats.map((s) => s.model))].join(", ");
}

// --- Scoring ---------------------------------------------------------------------

/** One check against one finished table. Null when the check doesn't apply to this table — never a miss. */
export function scoreTableCheck(check: TableCheck, report: RoundtableReport): boolean | number | null {
  if (check === "reached-consensus") return report.complete ? report.consensus !== null : null;
  if (check === "consensus-round") return report.complete ? report.consensusRound : null;
  if (check === "seats-moved") {
    if (!report.complete || report.rows.some((r) => r.final === null)) return null;
    return report.rows.filter((r) => r.trajectory[0] !== null && r.final !== r.trajectory[0]).length;
  }
  const c = report.checks.find((x) => x.id === check);
  if (!c || c.result === "na") return null;
  return c.result === "held";
}

/** Scores for every table measure in the experiment. Other measure kinds are scored elsewhere. */
export function scoreTable(
  e: Pick<Experiment, "table" | "conditions" | "measures">,
  conditionId: string,
  turns: Turn[],
  stopReason: StopReason | null,
): ExperimentRun["scores"] {
  const t = tableFor(e, conditionId);
  const report = buildRoundtableReport(t.seats, t.protocol, turns, stopReason);
  const scores: ExperimentRun["scores"] = {};
  for (const m of e.measures) {
    if (m.kind === "table") scores[m.id] = scoreTableCheck(m.check, report);
  }
  return scores;
}

// --- Estimates and the manifest --------------------------------------------------------

const isFree = (p: string) => p === "webllm" || p === "shape-free";

/**
 * Preflight for a table experiment: calls, dollars, and how many calls draw on
 * the hosted free tier. Tables are costed with the playground's own estimate;
 * a judge reads the whole transcript (~150 output tokens a turn).
 */
export function estimateTableCost(e: Experiment): { calls: number; usd: number; free: boolean; hostedCalls: number } {
  let calls = 0;
  let usd = 0;
  let free = true;
  let hostedCalls = 0;
  const judges = e.measures.filter((m) => m.kind === "classify" || m.kind === "rate") as Extract<
    Measure,
    { kind: "classify" | "rate" }
  >[];
  for (const c of e.conditions) {
    const t = tableFor(e, c.id);
    const perTable = callsFor(t.seats, t.protocol);
    calls += e.n * (perTable + judges.length);
    usd += e.n * estimateRoundtableCost(t.seats, t.protocol, t.task);
    for (const s of t.seats) {
      if (!isFree(s.provider)) free = false;
      if (s.provider === "shape-free") hostedCalls += e.n * t.protocol.rounds;
    }
    for (const m of judges) {
      if (!isFree(m.judge.provider)) free = false;
      if (m.judge.provider === "shape-free") hostedCalls += e.n;
    }
  }
  return { calls, usd: free ? 0 : usd, free, hostedCalls };
}

export type TableManifest = {
  task: Task;
  temperature: number;
  seats: { id: string; name: string; provider: string; model: string; plant?: string; role: string }[];
  /** Each condition's protocol and speaking order, with each seat's system prompt as that condition sends it. */
  conditions: { conditionId: string; protocol: Protocol; order: string[]; systems: Record<string, string> }[];
};

export function tableManifest(e: Experiment): TableManifest {
  if (!e.table) throw new Error("Not a Round Table experiment.");
  return {
    task: e.table.task,
    temperature: e.table.temperature,
    seats: e.table.seats.map((s) => ({
      id: s.id,
      name: s.name,
      provider: s.provider,
      model: s.model,
      role: s.role,
      ...(s.plant ? { plant: s.plant } : {}),
    })),
    conditions: e.conditions.map((c) => {
      const t = tableFor(e, c.id);
      return {
        conditionId: c.id,
        protocol: t.protocol,
        order: t.seats.map((s) => s.id),
        systems: Object.fromEntries(t.seats.map((s) => [s.id, composeSeatSystem(s, t.seats, t.protocol)])),
      };
    }),
  };
}

// --- Validation --------------------------------------------------------------------

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === "string";
const STANCES = ["for", "against"];

function protocolProblem(p: Record<string, unknown>, partial: boolean): string | null {
  const has = (k: string) => k in p;
  if ((!partial || has("rounds")) && !(Number.isInteger(p.rounds) && (p.rounds as number) >= 1 && (p.rounds as number) <= MAX_ROUNDS)) {
    return `Rounds must be a whole number from 1 to ${MAX_ROUNDS}.`;
  }
  if ((!partial || has("firstRound")) && p.firstRound !== "open" && p.firstRound !== "blind") return "Invalid first round.";
  if ((!partial || has("stopRule")) && p.stopRule !== "budget" && p.stopRule !== "consensus") return "Invalid stop rule.";
  if (has("whispers") && typeof p.whispers !== "boolean") return "Invalid side-notes setting.";
  return null;
}

/**
 * The Round Table parts of an imported or shared experiment. Returns what's
 * wrong, or null. Called by validateExperiment, which has already checked the
 * general shape.
 */
export function tableProblem(json: Record<string, unknown>): string | null {
  const table = json.table;
  const conditions = json.conditions as Record<string, unknown>[];
  const measures = json.measures as Record<string, unknown>[];
  const usesTable =
    conditions.some((c) => isObj(c.patch) && ("protocol" in c.patch || "firstSpeaker" in c.patch)) ||
    measures.some((m) => m.kind === "table");

  if (table === undefined) return usesTable ? "Round Table conditions or measures need a table." : null;
  if (!isObj(table)) return "Invalid table.";
  const seats = table.seats;
  if (!Array.isArray(seats) || seats.length < MIN_SEATS || seats.length > MAX_SEATS) {
    return `A table needs ${MIN_SEATS} to ${MAX_SEATS} seats.`;
  }
  const seatIds = new Set<string>();
  for (const s of seats) {
    if (!isObj(s) || !isStr(s.id) || !isStr(s.name) || !isStr(s.role) || !isStr(s.provider) || !isStr(s.model)) {
      return "Invalid seat.";
    }
    if (s.plant !== undefined && !STANCES.includes(s.plant as string)) return `Invalid plant on seat "${s.id}".`;
    if (seatIds.has(s.id)) return `Duplicate seat id "${s.id}".`;
    seatIds.add(s.id);
  }
  if (!isObj(table.task) || !isStr(table.task.proposal) || !isStr(table.task.brief)) return "Invalid decision.";
  if (!isObj(table.protocol)) return "Invalid protocol.";
  const pp = protocolProblem(table.protocol, false);
  if (pp) return pp;
  if (typeof table.temperature !== "number") return "Invalid table temperature.";
  if (Array.isArray(json.items) && json.items.length > 0) return "A Round Table experiment has no items: the decision is fixed.";

  for (const c of conditions) {
    const patch = c.patch as Record<string, unknown>;
    if (patch.protocol !== undefined) {
      if (!isObj(patch.protocol)) return `Invalid protocol in condition "${c.id}".`;
      const cp = protocolProblem(patch.protocol, true);
      if (cp) return `Condition "${c.id}": ${cp}`;
    }
    if (patch.firstSpeaker !== undefined && !(isStr(patch.firstSpeaker) && seatIds.has(patch.firstSpeaker))) {
      return `Condition "${c.id}" names a first speaker who isn't at the table.`;
    }
    if (patch.system !== undefined || patch.userTemplate !== undefined || patch.model !== undefined) {
      return `Condition "${c.id}" changes a prompt or model; a Round Table condition changes only the protocol.`;
    }
  }
  for (const m of measures) {
    if (m.kind === "table" && !isTableCheck(m.check)) return `Measure "${m.id}" has an unknown table check.`;
  }
  for (const r of json.runs as Record<string, unknown>[]) {
    if (r.turns !== undefined && !Array.isArray(r.turns)) return "A run's turns are invalid.";
  }
  return null;
}

// --- From the playground ---------------------------------------------------------------

/**
 * A Lab experiment from a Round Table: the table as it stands is the baseline,
 * and the comparison flips the first round (open ↔ blind) — the lever the
 * lesson is about. Measures default to the checks that apply to this table.
 */
export function fromRoundtable(table: TableSetup, now = Date.now()): Experiment {
  const planted = table.seats.find((s) => s.plant);
  const flipped: Protocol["firstRound"] = table.protocol.firstRound === "open" ? "blind" : "open";
  const label = (f: Protocol["firstRound"]) => (f === "open" ? "Open first round" : "Blind first round");
  const conditions: Condition[] = [
    { id: "c_base", label: label(table.protocol.firstRound), patch: {} },
    { id: "c_flip", label: label(flipped), patch: { protocol: { firstRound: flipped } } },
  ];
  const checks: TableCheck[] = [
    ...(planted ? (["planted-held"] as const) : []),
    "dissent-survived",
    "not-anchored",
    ...(table.protocol.whispers ? (["no-move-after-note"] as const) : []),
    "clear-stances",
  ];
  const lead = table.seats[0]!;
  return {
    id: `exp_${now.toString(36)}`,
    title: planted ? `Does ${planted.name} hold the line?` : "Does the room keep its disagreement?",
    question: planted
      ? `How often does ${planted.name}, planted to argue ${planted.plant}, still hold that position when the table stops — and does a ${flipped} first round change it?`
      : `How often does the table keep its disagreement — and does a ${flipped} first round change it?`,
    hypothesis:
      flipped === "blind"
        ? "A blind first round, where everyone commits before hearing anyone, protects dissent."
        : "An open first round, where seats hear each other from the start, makes the table converge more often.",
    base: {
      // Unused by a table run; kept so the experiment has the Lab's usual shape.
      system: "",
      userTemplate: table.task.proposal,
      temperature: table.temperature,
      maxTokens: 400,
      model: { provider: lead.provider, model: lead.model },
    },
    table,
    conditions,
    items: [],
    n: TABLE_DEFAULT_N,
    measures: checks.map((check) => ({ id: `m_${check}`, label: TABLE_CHECKS[check].label, kind: "table" as const, check })),
    runs: [],
    createdAt: now,
    updatedAt: now,
  };
}
