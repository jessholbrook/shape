"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useDrafts } from "@/lib/hooks/use-drafts";
import { PROVIDERS } from "@/lib/providers";
import { ARTIFACT_KIND_LABEL } from "@/lib/kinds";
import { composePersonaSections } from "@/lib/persona";
import { TONE_DIMENSIONS, type ToneValues } from "@/lib/tone";
import {
  EXPECTED_LABEL,
  VERDICT_LABEL,
  evaluateMatch,
} from "@/lib/refusal";
import { aggregateScore, caseScore, SCORE_MAX } from "@/lib/evals";
import type {
  ChoreographerDraft,
  DiffDraft,
  Draft,
  EvalsDraft,
  PersonaDraft,
  RefusalDraft,
  ToneDraft,
} from "@/lib/drafts";

export function PrintDraft() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const { drafts, hydrated } = useDrafts();
  const draft = id ? drafts.find((d) => d.id === id) ?? null : null;

  if (!hydrated) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-16">
        <p className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
          Loading…
        </p>
      </main>
    );
  }

  if (!draft) {
    return (
      <main className="mx-auto max-w-[760px] px-6 py-16">
        <p className="font-sans text-[15px] text-ink">
          Draft not found. Drafts live only in the browser they were saved
          in — this link won&apos;t work anywhere else. If someone sent it
          to you, ask them for the PDF or JSON export instead.
        </p>
        <Link
          href="/notebook"
          className="mt-4 inline-block font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          ← Notebook
        </Link>
      </main>
    );
  }

  const date = new Date(draft.updatedAt).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <main className="min-h-screen bg-canvas">
      <div
        data-print-hide
        className="mx-auto max-w-[760px] px-6 pt-8 flex items-center justify-between gap-3"
      >
        <Link
          href="/notebook"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          ← Notebook
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] hover:bg-ink/90 transition-colors"
        >
          Save as PDF
          <span className="text-highlight">→</span>
        </button>
      </div>

      <article className="mx-auto max-w-[760px] px-6 py-10 print:py-0">
        <header className="pb-6 border-b border-line">
          <p className="font-mono text-[11px] uppercase tracking-[0.1em] text-highlight-ink">
            {ARTIFACT_KIND_LABEL[draft.kind]}
          </p>
          <h1 className="font-display text-[40px] leading-[1.05] tracking-tight text-ink mt-2">
            {draft.title || "Untitled"}
          </h1>
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mt-3">
            {draftMeta(draft)} · {date} · made with Shape
          </p>
        </header>

        <DraftBody draft={draft} />
      </article>
    </main>
  );
}

function modelLabel(provider: keyof typeof PROVIDERS, model: string): string {
  return (
    PROVIDERS[provider].models.find((m) => m.id === model)?.name ?? model
  );
}

/** Header meta line. Diff drafts carry per-side configs instead of a single
 *  top-level model, so they get an A/B summary. */
function draftMeta(draft: Draft): string {
  if (draft.kind === "diff") {
    const a = modelLabel(draft.configA.provider, draft.configA.model);
    const b = modelLabel(draft.configB.provider, draft.configB.model);
    return `A: ${a} · B: ${b}`;
  }
  return `${modelLabel(draft.provider, draft.model)} · temp ${draft.temperature.toFixed(1)}`;
}

function DraftBody({ draft }: { draft: Draft }) {
  switch (draft.kind) {
    case "persona":
      return <PersonaBody draft={draft} />;
    case "tone":
      return <ToneBody draft={draft} />;
    case "diff":
      return <DiffBody draft={draft} />;
    case "refusal":
      return <RefusalBody draft={draft} />;
    case "evals":
      return <EvalsBody draft={draft} />;
    case "choreographer":
      return <ChoreographerBody draft={draft} />;
  }
}

/* ---------------------------------------------------------------- shared */

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 break-inside-avoid">
      <h2 className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet mb-3">
        {label}
      </h2>
      {children}
    </section>
  );
}

function MonoBlock({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words bg-surface border border-line rounded-[10px] p-4">
      {children}
    </div>
  );
}

function Prose({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[14px] leading-[1.6] text-ink whitespace-pre-wrap">
      {children}
    </p>
  );
}

function Exchange({
  who,
  children,
}: {
  who: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 first:mt-0">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
        {who}
      </p>
      <p className="font-sans text-[13px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
        {children}
      </p>
    </div>
  );
}

function toneSummary(tone: ToneValues): string[] {
  return TONE_DIMENSIONS.filter((d) => tone[d.id] !== 0).map(
    (d) => `${d.label}: ${d.stops[tone[d.id] + 2].label}`,
  );
}

/* -------------------------------------------------------------- per kind */

function PersonaBody({ draft }: { draft: PersonaDraft }) {
  const sections = composePersonaSections(draft.persona);
  const transcript =
    draft.transcript ??
    (draft.lastOutput
      ? [
          { role: "user" as const, content: draft.lastUserMessage },
          { role: "assistant" as const, content: draft.lastOutput },
        ]
      : []);
  const personaLabel = draft.persona.name.trim() || "Persona";

  return (
    <>
      <Section label="System prompt">
        <MonoBlock>{sections.map((s) => s.text).join("\n\n")}</MonoBlock>
      </Section>
      {transcript.length > 0 && (
        <Section label="Sample conversation">
          {transcript.map((m, i) => (
            <Exchange key={i} who={m.role === "user" ? "You" : personaLabel}>
              {m.content}
            </Exchange>
          ))}
        </Section>
      )}
    </>
  );
}

function ToneBody({ draft }: { draft: ToneDraft }) {
  const dials = toneSummary(draft.tone);
  return (
    <>
      <Section label="Brief">
        <Prose>{draft.brief}</Prose>
      </Section>
      {dials.length > 0 && (
        <Section label="Tone dials">
          <ul className="flex flex-col gap-1">
            {dials.map((d) => (
              <li key={d} className="font-mono text-[12px] text-ink">
                {d}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {(draft.lastUserMessage || draft.lastOutput) && (
        <Section label="Sample">
          {draft.lastUserMessage && (
            <Exchange who="User message">{draft.lastUserMessage}</Exchange>
          )}
          {draft.lastOutput && (
            <Exchange who="Output">{draft.lastOutput}</Exchange>
          )}
        </Section>
      )}
    </>
  );
}

function DiffBody({ draft }: { draft: DiffDraft }) {
  const sideName = (which: "A" | "B") => {
    const config = which === "A" ? draft.configA : draft.configB;
    return (
      PROVIDERS[config.provider].models.find((m) => m.id === config.model)
        ?.name ?? config.model
    );
  };
  return (
    <>
      <Section label="Configurations">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2">
          {(["A", "B"] as const).map((which) => {
            const config = which === "A" ? draft.configA : draft.configB;
            return (
              <div key={which}>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                  Config {which} — {sideName(which)} · temp{" "}
                  {config.temperature.toFixed(1)}
                </p>
                <MonoBlock>{config.system || "(no system prompt)"}</MonoBlock>
              </div>
            );
          })}
        </div>
      </Section>
      {draft.pins && draft.pins.length > 0 && (
        <Section label="Pinned phrases">
          <ul className="flex flex-col gap-1">
            {draft.pins.map((p) => (
              <li key={p} className="font-mono text-[12px] text-ink">
                &ldquo;{p}&rdquo;
              </li>
            ))}
          </ul>
        </Section>
      )}
      {draft.turns.map((t, i) => (
        <Section key={t.id} label={`Turn ${i + 1}`}>
          <Exchange who="User message">{t.userMessage}</Exchange>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-2 mt-3">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                A — {sideName("A")}
              </p>
              <MonoBlock>{t.outputA.text || "—"}</MonoBlock>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                B — {sideName("B")}
              </p>
              <MonoBlock>{t.outputB.text || "—"}</MonoBlock>
            </div>
          </div>
          {t.note && (
            <div className="mt-3">
              <Exchange who="Note">{t.note}</Exchange>
            </div>
          )}
        </Section>
      ))}
    </>
  );
}

function RefusalBody({ draft }: { draft: RefusalDraft }) {
  let matched = 0;
  let scored = 0;
  for (const probe of draft.probes) {
    const verdict = draft.results[probe.id]?.verdict;
    const m = evaluateMatch(probe.expected, verdict ?? null);
    if (m !== "pending") scored += 1;
    if (m === "match") matched += 1;
  }
  return (
    <>
      <Section label="Refusal guidelines (system prompt)">
        <MonoBlock>{draft.guidelines}</MonoBlock>
      </Section>
      <Section label="Scorecard">
        <Prose>
          {matched}/{draft.probes.length} match
          {scored < draft.probes.length
            ? ` — ${draft.probes.length - scored} unscored`
            : ""}
        </Prose>
      </Section>
      {draft.probes.map((probe, i) => {
        const result = draft.results[probe.id];
        const verdict = result?.verdict;
        return (
          <Section key={probe.id} label={`Probe ${i + 1} — ${probe.label}`}>
            <Exchange who="User message">{probe.userMessage}</Exchange>
            <p className="font-mono text-[11px] text-ink-quiet mt-2">
              Expected: {EXPECTED_LABEL[probe.expected]}
              {verdict ? ` · Verdict: ${VERDICT_LABEL[verdict]}` : ""}
            </p>
            <div className="mt-2">
              <MonoBlock>{result?.output || "Not run."}</MonoBlock>
            </div>
          </Section>
        );
      })}
    </>
  );
}

function EvalsBody({ draft }: { draft: EvalsDraft }) {
  const agg = aggregateScore(draft.rubric, draft.cases, draft.results);
  const max = draft.rubric.length * SCORE_MAX;
  return (
    <>
      <Section label="System prompt under test">
        <MonoBlock>{draft.systemPrompt}</MonoBlock>
      </Section>
      <Section label="Rubric">
        <ul className="flex flex-col gap-2">
          {draft.rubric.map((c) => (
            <li key={c.id}>
              <p className="font-mono text-[12px] text-ink">{c.name}</p>
              {c.description && (
                <p className="font-sans text-[12px] text-ink-muted">
                  {c.description}
                </p>
              )}
            </li>
          ))}
        </ul>
        {agg.avg !== null && (
          <p className="font-mono text-[12px] text-ink mt-3">
            Average {agg.avg.toFixed(1)}/{max} across {draft.cases.length}{" "}
            cases
          </p>
        )}
      </Section>
      {draft.cases.map((c, i) => {
        const result = draft.results[c.id];
        const score = result ? caseScore(draft.rubric, result) : null;
        return (
          <Section key={c.id} label={`Case ${i + 1} — ${c.label}`}>
            <Exchange who="User message">{c.userMessage}</Exchange>
            <div className="mt-2">
              <MonoBlock>{result?.output || "Not run."}</MonoBlock>
            </div>
            {score && (
              <p className="font-mono text-[11px] text-ink mt-2">
                Score {score.total}/{score.max}
                {draft.rubric
                  .map((r) =>
                    result?.scores[r.id] != null
                      ? ` · ${r.name} ${result.scores[r.id]}`
                      : "",
                  )
                  .join("")}
              </p>
            )}
            {result?.note && (
              <div className="mt-2">
                <Exchange who="Reviewer note">{result.note}</Exchange>
              </div>
            )}
          </Section>
        );
      })}
    </>
  );
}

function ChoreographerBody({ draft }: { draft: ChoreographerDraft }) {
  return (
    <>
      <Section label="System prompt">
        <MonoBlock>{draft.systemPrompt}</MonoBlock>
      </Section>
      {draft.turns.map((t, i) => (
        <Section key={t.id} label={`Turn ${i + 1}`}>
          <Exchange who="User">{t.userMessage}</Exchange>
          <div className="mt-2">
            <MonoBlock>{t.assistant.text || "Not run."}</MonoBlock>
          </div>
          {t.assistant.note && (
            <div className="mt-2">
              <Exchange who="Note">{t.assistant.note}</Exchange>
            </div>
          )}
        </Section>
      ))}
    </>
  );
}

