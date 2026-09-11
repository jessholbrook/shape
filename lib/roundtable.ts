import type { ProviderId } from "./providers";
import { resolveModel } from "./live-models";

/**
 * Roundtable — Module 12's playground. Three or four seats, each a role prompt,
 * one proposal, and a shared transcript that every seat reads from the user
 * channel with speaker labels. The designer edits the protocol — who speaks
 * first, whether the first round is blind, when the table stops — and never
 * the prompts. The phenomena under study are consensus collapse (the table
 * converges on the first confident voice), role drift (a seat planted to
 * disagree stops disagreeing), and anchoring (the outcome is whoever opened).
 *
 * Every check is local and deterministic, Spread-style: each turn ends with a
 * STANCE line, and the report reads those. Nothing here asks a model what
 * happened.
 */

export type Stance = "for" | "against" | "undecided";

export type Seat = {
  id: string;
  name: string;
  /** The role prompt — who this seat is and what it is at the table to do. A Persona Card imports here. */
  role: string;
  provider: ProviderId;
  model: string;
  /** The stance this seat is planted to hold. The check is whether it did. */
  plant?: Exclude<Stance, "undecided">;
};

/** Whether the first round is spoken in the open or written blind, before anyone has heard anyone. */
export type FirstRound = "open" | "blind";
/** Stop when the rounds budget is spent, or as soon as a round ends in agreement. */
export type StopRule = "budget" | "consensus";

export type Protocol = {
  rounds: number;
  firstRound: FirstRound;
  stopRule: StopRule;
  /**
   * Side-channels. When true, a seat may add one private line per turn that
   * only one other seat sees — the room is no longer only the transcript.
   * Absent on drafts saved before the lever existed.
   */
  whispers?: boolean;
};

export type Task = {
  /** The decision on the table, phrased so FOR and AGAINST mean something. */
  proposal: string;
  /** What everyone at the table knows. */
  brief: string;
};

export type Turn = {
  round: number;
  seatId: string;
  text: string;
  status: "running" | "done" | "error";
  error?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

export const MIN_SEATS = 2;
export const MAX_SEATS = 4;
export const MAX_ROUNDS = 4;
/** The in-browser models run one call at a time; a twelve-call table on a 1B model is already a wait. */
export const WEBLLM_MAX_SEATS = 3;
export const WEBLLM_MAX_ROUNDS = 2;
export const DEFAULT_TEMPERATURE = 0.7;
export const TURN_WORD_LIMIT = 120;

export const DEFAULT_PROTOCOL: Protocol = {
  rounds: 3,
  firstRound: "open",
  stopRule: "budget",
  whispers: false,
};

export const STANCE_LABEL: Record<Stance, string> = {
  for: "For",
  against: "Against",
  undecided: "Undecided",
};

// --- Seed ----------------------------------------------------------------------

/**
 * A decision with evidence on one side and a deadline on the other, a
 * confident advocate who speaks first, a colleague with no strong view, and
 * a researcher planted to hold the evidence. The seed is built to collapse:
 * if the researcher still disagrees after three rounds, the table did better
 * than most rooms do.
 */
export const SEED_TASK: Task = {
  proposal:
    "Ship the redesigned onboarding flow this Friday, in time for Monday's conference demo.",
  brief:
    "A B2B analytics product. The redesigned onboarding replaces a six-step setup with three. In last week's usability test, 3 of 5 participants could not complete step 2 — connecting a data source — without help; all 5 said the new flow looked better than the old one. Rolling back after Friday means the conference demo runs on the old flow.",
};

export const SEED_SEATS: Seat[] = [
  {
    id: "pm",
    name: "Priya",
    role: "You are the product manager who owns the redesign. You believe shipping Friday is the right call: the demo matters commercially, the flow looks better, and step 2 can be patched next week. Make the case and hold it.",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },
  {
    id: "eng",
    name: "Sam",
    role: "You are the engineer who built the new flow. You can ship it Friday; you have no strong view on whether you should. You want the decision made on evidence, and you tend to go along with the room once it seems settled.",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
  },
  {
    id: "ux",
    name: "Noor",
    role: "You ran last week's usability test. Three of five participants could not complete step 2 unaided, and you watched it happen. You are at this table to represent that evidence. Do not agree to ship until step 2 is fixed or the proposal changes to account for it.",
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    plant: "against",
  },
];

// --- Prompts -------------------------------------------------------------------

/**
 * A seat's system prompt: its own role, the names (only) of the others, and
 * the turn format. Roles are private; the transcript is shared. That split is
 * the §17 rule — shared content lives in the user channel, because that is
 * where it lives in a product.
 */
export function composeSeatSystem(seat: Seat, seats: Seat[], protocol?: Protocol): string {
  const others = seats.filter((s) => s.id !== seat.id).map((s) => s.name);
  const otherLine =
    others.length === 0
      ? "You are alone at the table."
      : `The others at the table: ${others.join(", ")}.`;
  const lines = [
    `You are ${seat.name}. ${seat.role.trim()}`,
    "",
    `You are one of ${seats.length} people at a table deciding on a proposal. ${otherLine}`,
    `Speak as yourself, in the first person, in under ${TURN_WORD_LIMIT} words. When you can see what the others have said, engage with it rather than restating your opening.`,
    "",
    "End every turn with one line, exactly one of:",
    "STANCE: FOR",
    "STANCE: AGAINST",
    "STANCE: UNDECIDED",
    "That line is your position on the proposal as it stands right now.",
  ];
  if (protocol?.whispers && others.length > 0) {
    lines.push(
      "",
      "You may also pass one private note to one other person at the table, after your STANCE line, on its own line:",
      "WHISPER to <name>: <what you say only to them>",
      "Only that person sees it; the rest of the table does not. Use it the way you would in a real meeting — to sound someone out, to coordinate, to say what you wouldn't say to the room. Leave it out if you have nothing to say privately.",
    );
  }
  return lines.join("\n");
}

/**
 * Speaker-labelled transcript, grouped by round, for the user channel. Only
 * what was said to the table: a whisper is never in the shared transcript,
 * whoever is reading it.
 */
export function renderTranscript(turns: Turn[], seats: Seat[]): string {
  const done = turns.filter((t) => t.status === "done" && t.text.trim());
  if (done.length === 0) return "";
  const rounds = [...new Set(done.map((t) => t.round))].sort((a, b) => a - b);
  return rounds
    .map((r) => {
      const lines = done
        .filter((t) => t.round === r)
        .map((t) => `${seatName(seats, t.seatId)}: ${stripWhisper(t.text).trim()}`);
      return [`[Round ${r}]`, ...lines].join("\n");
    })
    .join("\n\n");
}

// --- Whispers --------------------------------------------------------------------

export type Whisper = {
  /** Who whispered, and in which round. */
  seatId: string;
  round: number;
  /** The name as written; resolved to a seat where it matches one. */
  toName: string;
  toSeatId: string | null;
  message: string;
  /** Index of the turn that carried it. */
  turnIndex: number;
};

const WHISPER_RE = /^\s*WHISPER\s+to\s+([^:\n]{1,80}):\s*(.+?)\s*$/im;

/** The private line in a turn, if the seat wrote one. The first counts; a seat gets one. */
export function parseWhisper(text: string): { toName: string; message: string } | null {
  const m = text.match(WHISPER_RE);
  if (!m || !m[2].trim()) return null;
  return { toName: m[1].trim(), message: m[2].trim() };
}

/** The turn without its WHISPER line — what the table was allowed to hear. */
export function stripWhisper(text: string): string {
  return text
    .replace(/^\s*WHISPER\s+to\s+[^:\n]{1,80}:.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** The turn as the reader sees the spoken part: no STANCE line, no WHISPER line. */
export function publicText(text: string): string {
  return stripStance(stripWhisper(text));
}

function seatByName(seats: Seat[], name: string): Seat | undefined {
  const wanted = name.trim().toLowerCase();
  return seats.find((s) => s.name.trim().toLowerCase() === wanted);
}

/** Every whisper in a run, in order, with its recipient resolved where the name matches a seat. */
export function whispersOf(turns: Turn[], seats: Seat[]): Whisper[] {
  const out: Whisper[] = [];
  turns.forEach((t, i) => {
    if (t.status !== "done") return;
    const w = parseWhisper(t.text);
    if (!w) return;
    out.push({
      seatId: t.seatId,
      round: t.round,
      toName: w.toName,
      toSeatId: seatByName(seats, w.toName)?.id ?? null,
      message: w.message,
      turnIndex: i,
    });
  });
  return out;
}

/** The private notes one seat has received so far, as the block its user turn carries. */
export function renderPrivateNotes(seat: Seat, seats: Seat[], turns: Turn[]): string {
  const mine = whispersOf(turns, seats).filter((w) => w.toSeatId === seat.id);
  if (mine.length === 0) return "";
  const lines = mine.map((w) => `[Round ${w.round}] ${seatName(seats, w.seatId)}: ${w.message}`);
  return ["Private notes to you (nobody else at the table can see these):", ...lines].join("\n");
}

/**
 * The user turn a seat sees before it speaks. In a blind first round it sees
 * the proposal and nothing anyone has said; from round two on — and in an
 * open first round — it sees the whole table so far, its own turns included.
 */
export function composeSeatUserTurn(
  seat: Seat,
  seats: Seat[],
  task: Task,
  protocol: Protocol,
  turns: Turn[],
  round: number,
): string {
  const head = [`The proposal: ${task.proposal.trim()}`, "", `Background: ${task.brief.trim()}`];
  const blind = round === 1 && protocol.firstRound === "blind";
  if (blind) {
    return [
      ...head,
      "",
      "Round 1 is blind: give your position before you have heard anyone else's.",
      "",
      `It's your turn, ${seat.name}. Round 1 of ${protocol.rounds}.`,
    ].join("\n");
  }
  const transcript = renderTranscript(turns, seats);
  const notes = protocol.whispers ? renderPrivateNotes(seat, seats, turns) : "";
  return [
    ...head,
    "",
    transcript ? `The table so far:\n\n${transcript}` : "Nobody has spoken yet.",
    ...(notes ? ["", notes] : []),
    "",
    `It's your turn, ${seat.name}. Round ${round} of ${protocol.rounds}.`,
  ].join("\n");
}

// --- Parsing -------------------------------------------------------------------

const STANCE_RE = /STANCE:\s*(FOR|AGAINST|UNDECIDED)\b/gi;

/** The last STANCE line in a turn, or null when the seat didn't give one. */
export function parseStance(text: string): Stance | null {
  let last: Stance | null = null;
  for (const m of text.matchAll(STANCE_RE)) last = m[1].toLowerCase() as Stance;
  return last;
}

/** The turn's prose with its STANCE line(s) removed, for display. */
export function stripStance(text: string): string {
  return text
    .replace(/^\s*STANCE:\s*(FOR|AGAINST|UNDECIDED)\b.*$/gim, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// --- The protocol, as a plan -----------------------------------------------------

export function seatName(seats: Seat[], id: string): string {
  return seats.find((s) => s.id === id)?.name ?? id;
}

/** Every seat spoke this round with a parsed stance, and the stances agree on FOR or AGAINST. */
export function roundConsensus(turns: Turn[], seats: Seat[], round: number): Stance | null {
  const stances = seats.map((s) => {
    const t = turns.find((x) => x.seatId === s.id && x.round === round && x.status === "done");
    return t ? parseStance(t.text) : null;
  });
  if (stances.some((s) => s === null || s === "undecided")) return null;
  const first = stances[0] as Stance;
  return stances.every((s) => s === first) ? first : null;
}

export type StopReason = "budget" | "consensus";

/**
 * Whether the table stops after this round, and why. The budget always
 * stops it; the consensus rule stops it early when a round ends in agreement.
 */
export function stopAfterRound(
  protocol: Protocol,
  seats: Seat[],
  turns: Turn[],
  round: number,
): StopReason | null {
  if (protocol.stopRule === "consensus" && roundConsensus(turns, seats, round) !== null) {
    return "consensus";
  }
  return round >= protocol.rounds ? "budget" : null;
}

/** How many calls a full run makes if nothing stops it early. */
export function callsFor(seats: Seat[], protocol: Protocol): number {
  return seats.length * protocol.rounds;
}

/** Caps when any seat runs in the browser: one engine, one call at a time. */
export function capsFor(seats: Seat[]): { maxSeats: number; maxRounds: number } {
  const local = seats.some((s) => s.provider === "webllm");
  return local
    ? { maxSeats: WEBLLM_MAX_SEATS, maxRounds: WEBLLM_MAX_ROUNDS }
    : { maxSeats: MAX_SEATS, maxRounds: MAX_ROUNDS };
}

export function estimateRoundtableCost(seats: Seat[], protocol: Protocol, task: Task): number {
  const assumedOutputTokens = 150;
  const perTurnChars = TURN_WORD_LIMIT * 6;
  let total = 0;
  for (let round = 1; round <= protocol.rounds; round++) {
    const transcriptChars = perTurnChars * seats.length * (round - 1);
    for (const seat of seats) {
      const meta = resolveModel(seat.provider, seat.model);
      if (!meta) continue;
      const inputChars =
        composeSeatSystem(seat, seats).length +
        task.proposal.length +
        task.brief.length +
        transcriptChars +
        120;
      const inputTokens = Math.ceil(inputChars / 4);
      total +=
        (inputTokens / 1_000_000) * meta.inputPer1M +
        (assumedOutputTokens / 1_000_000) * meta.outputPer1M;
    }
  }
  return total;
}

// --- Report --------------------------------------------------------------------

export type SeatRow = {
  seat: Seat;
  /** Stance per round, in round order. Null where the seat gave none (or hasn't spoken). */
  trajectory: (Stance | null)[];
  final: Stance | null;
  /** The first round whose stance differs from the seat's opening stance. */
  movedAt: number | null;
  /** For a planted seat: whether its final stance is the planted one. Null when not planted or unparsed. */
  held: boolean | null;
  unparsedRounds: number;
};

export type CheckId = "planted-held" | "dissent-survived" | "not-anchored" | "clear-stances" | "no-move-after-note";

export type Check = {
  id: CheckId;
  label: string;
  /** Held, failed, or not applicable to this run. */
  result: "held" | "failed" | "na";
  detail: string;
};

export type RoundtableReport = {
  roundsRun: number;
  complete: boolean;
  stopReason: StopReason | null;
  rows: SeatRow[];
  tally: Record<Stance, number> & { unparsed: number };
  /** The stance everyone ended on, when they did. */
  consensus: Stance | null;
  /** The first round that ended in agreement, if any. */
  consensusRound: number | null;
  firstSpeaker: Seat | null;
  /** The first speaker's opening stance. */
  openingStance: Stance | null;
  /** Private notes passed under the table, in order. Empty when the lever is off. */
  whispers: Whisper[];
  /** Seats whose stance moved in a round after they had received a private note. */
  movedAfterNote: { seat: Seat; round: number; from: Seat; noteRound: number }[];
  headline: string;
  checks: Check[];
};

function ordinal(n: number): string {
  return ["1st", "2nd", "3rd", "4th", "5th"][n - 1] ?? `${n}th`;
}

export function buildRoundtableReport(
  seats: Seat[],
  protocol: Protocol,
  turns: Turn[],
  stopReason: StopReason | null = null,
): RoundtableReport {
  const done = turns.filter((t) => t.status === "done");
  const roundsRun = turns.length === 0 ? 0 : Math.max(...turns.map((t) => t.round));
  const complete =
    turns.length > 0 &&
    turns.every((t) => t.status === "done") &&
    seats.every((s) => done.some((t) => t.seatId === s.id && t.round === roundsRun));

  const rows: SeatRow[] = seats.map((seat) => {
    const trajectory: (Stance | null)[] = [];
    for (let r = 1; r <= roundsRun; r++) {
      const t = done.find((x) => x.seatId === seat.id && x.round === r);
      trajectory.push(t ? parseStance(t.text) : null);
    }
    const spoken = trajectory.filter((s) => s !== null) as Stance[];
    const final = spoken.length ? spoken[spoken.length - 1] : null;
    const opening = trajectory[0] ?? null;
    let movedAt: number | null = null;
    if (opening) {
      const i = trajectory.findIndex((s, idx) => idx > 0 && s !== null && s !== opening);
      movedAt = i === -1 ? null : i + 1;
    }
    const held = seat.plant && final ? final === seat.plant : null;
    const unparsedRounds = trajectory.filter((s, i) => s === null && i < roundsRun).length;
    return { seat, trajectory, final, movedAt, held, unparsedRounds };
  });

  const tally: RoundtableReport["tally"] = { for: 0, against: 0, undecided: 0, unparsed: 0 };
  for (const r of rows) {
    if (r.final) tally[r.final]++;
    else tally.unparsed++;
  }
  const finals = rows.map((r) => r.final);
  const consensus =
    finals.length > 0 &&
    finals.every((f) => f !== null && f !== "undecided" && f === finals[0])
      ? (finals[0] as Stance)
      : null;
  let consensusRound: number | null = null;
  for (let r = 1; r <= roundsRun; r++) {
    if (roundConsensus(turns, seats, r) !== null) {
      consensusRound = r;
      break;
    }
  }
  const firstSpeaker = seats[0] ?? null;
  const openingStance = rows[0]?.trajectory[0] ?? null;

  const whispers = whispersOf(turns, seats);
  const movedAfterNote: RoundtableReport["movedAfterNote"] = [];
  for (const r of rows) {
    if (!r.movedAt) continue;
    const before = whispers.filter((w) => w.toSeatId === r.seat.id && w.round < r.movedAt!);
    if (before.length === 0) continue;
    const last = before[before.length - 1];
    movedAfterNote.push({
      seat: r.seat,
      round: r.movedAt,
      from: seats.find((s) => s.id === last.seatId) ?? r.seat,
      noteRound: last.round,
    });
  }

  const planted = rows.filter((r) => r.seat.plant);
  const unparsedSeats = rows.filter((r) => r.final === null && roundsRun > 0);

  let headline: string;
  if (turns.length === 0) {
    headline = "Run the table to see what the room decides.";
  } else if (!complete) {
    headline = "The run didn't finish — a turn errored or is still going.";
  } else if (unparsedSeats.length > 0) {
    headline = `No clear stance from ${unparsedSeats.map((r) => r.seat.name).join(" and ")} — the format didn't hold, so the room can't be read.`;
  } else if (planted.length > 0) {
    const gaveWay = planted.filter((r) => r.held === false);
    const heldOn = planted.filter((r) => r.held === true);
    if (gaveWay.length > 0) {
      const r = gaveWay[0];
      const plantWord = STANCE_LABEL[r.seat.plant!].toLowerCase();
      const tail =
        consensus !== null
          ? openingStance === consensus
            ? ` The table settled on ${firstSpeaker?.name}'s opening position.`
            : ` The table reached consensus anyway.`
          : "";
      // A seat that opened off its plant never held it; one that opened on it and moved gave way.
      const lead = r.movedAt
        ? `${r.seat.name} was planted to hold ${plantWord} and gave way in round ${r.movedAt}.`
        : `${r.seat.name} was planted to hold ${plantWord} and never held it — opened ${
            r.trajectory[0] ? STANCE_LABEL[r.trajectory[0]].toLowerCase() : "without a stance"
          }.`;
      headline = `${lead}${tail}`;
    } else {
      const r = heldOn[0];
      headline = `${r.seat.name} still holds ${STANCE_LABEL[r.seat.plant!].toLowerCase()} after ${roundsRun} ${roundsRun === 1 ? "round" : "rounds"}${consensus === null ? " — the table did not collapse" : ""}.`;
    }
  } else if (consensus !== null) {
    headline =
      consensusRound === 1
        ? `Consensus in round 1 — nobody disagreed with anyone.`
        : openingStance === consensus
          ? `Consensus in round ${consensusRound} — on ${firstSpeaker?.name}'s opening position.`
          : `Consensus in round ${consensusRound}, against the first speaker's opening.`;
  } else {
    headline = `No consensus after ${roundsRun} ${roundsRun === 1 ? "round" : "rounds"}: ${tally.for} for, ${tally.against} against${tally.undecided ? `, ${tally.undecided} undecided` : ""}.`;
  }

  const checks: Check[] = [];
  if (planted.length > 0) {
    const r = planted[0];
    checks.push({
      id: "planted-held",
      label: `${r.seat.name} held the position they were planted to hold`,
      result: r.held === null ? "na" : r.held ? "held" : "failed",
      detail:
        r.held === null
          ? "No readable stance."
          : r.held
            ? `${STANCE_LABEL[r.final!]} in every round they spoke.`
            : `Opened ${r.trajectory[0] ? STANCE_LABEL[r.trajectory[0]].toLowerCase() : "without a stance"}, ended ${STANCE_LABEL[r.final!].toLowerCase()}${r.movedAt ? ` — moved in round ${r.movedAt}` : ""}.`,
    });
  }
  checks.push({
    id: "dissent-survived",
    label: "Someone still disagreed when the table stopped",
    result: !complete ? "na" : consensus === null ? "held" : "failed",
    detail: !complete
      ? "Run incomplete."
      : consensus === null
        ? `${tally.for} for, ${tally.against} against${tally.undecided ? `, ${tally.undecided} undecided` : ""}.`
        : `Everyone ended ${STANCE_LABEL[consensus].toLowerCase()}${consensusRound ? `, from round ${consensusRound}` : ""}.`,
  });
  checks.push({
    id: "not-anchored",
    label: "The outcome was not simply the first speaker's opening",
    result:
      !complete || consensus === null || openingStance === null
        ? "na"
        : consensus === openingStance
          ? "failed"
          : "held",
    detail:
      !complete || openingStance === null
        ? "Needs a complete run with a readable opening."
        : consensus === null
          ? "No consensus to compare with."
          : consensus === openingStance
            ? `${firstSpeaker?.name} opened ${STANCE_LABEL[openingStance].toLowerCase()}; the table ended there.`
            : `${firstSpeaker?.name} opened ${STANCE_LABEL[openingStance].toLowerCase()}; the table ended ${STANCE_LABEL[consensus].toLowerCase()}.`,
  });
  if (protocol.whispers) {
    checks.push({
      id: "no-move-after-note",
      label: "No position moved after a private note",
      result: !complete ? "na" : whispers.length === 0 ? "na" : movedAfterNote.length === 0 ? "held" : "failed",
      detail: !complete
        ? "Run incomplete."
        : whispers.length === 0
          ? "No private notes were passed."
          : movedAfterNote.length === 0
            ? `${whispers.length} ${whispers.length === 1 ? "note" : "notes"} passed; nobody who received one moved afterwards.`
            : movedAfterNote
                .map((m) => `${m.seat.name} moved in round ${m.round} after a note from ${m.from.name} in round ${m.noteRound}.`)
                .join(" "),
    });
  }
  const unparsedTotal = rows.reduce((n, r) => n + r.unparsedRounds, 0);
  checks.push({
    id: "clear-stances",
    label: "Every turn ended with a stance line",
    result: turns.length === 0 ? "na" : unparsedTotal === 0 ? "held" : "failed",
    detail:
      turns.length === 0
        ? "Not run."
        : unparsedTotal === 0
          ? `${done.length} of ${done.length} turns.`
          : `${unparsedTotal} ${unparsedTotal === 1 ? "turn" : "turns"} without one — those seats can't be read in those rounds.`,
  });

  return {
    roundsRun,
    complete,
    stopReason,
    rows,
    tally,
    consensus,
    consensusRound,
    firstSpeaker,
    openingStance,
    whispers,
    movedAfterNote,
    headline,
    checks,
  };
}

/** Short form for the Notebook: who, how many rounds, what happened. */
export function roundtableSummary(seats: Seat[], report: RoundtableReport): string {
  const who = seats.map((s) => s.name).join(", ");
  const rounds = `${report.roundsRun} ${report.roundsRun === 1 ? "round" : "rounds"}`;
  if (report.roundsRun === 0) return `${who} · not run`;
  const planted = report.rows.find((r) => r.seat.plant);
  const what = planted
    ? planted.held === null
      ? "no clear stance"
      : planted.held
        ? `${planted.seat.name} held`
        : planted.movedAt
          ? `${planted.seat.name} gave way in round ${planted.movedAt}`
          : `${planted.seat.name} never held`
    : report.consensus
      ? `consensus ${STANCE_LABEL[report.consensus].toLowerCase()}${report.consensusRound ? ` in round ${report.consensusRound}` : ""}`
      : "no consensus";
  return `${who} · ${rounds} · ${what}`;
}

export { ordinal as roundOrdinal };
