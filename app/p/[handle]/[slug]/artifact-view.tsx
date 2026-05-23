"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ARTIFACTS_EVENT,
  getArtifactBackend,
  type Artifact,
} from "@/lib/artifacts";
import { PROVIDERS } from "@/lib/providers";
import { TONE_DIMENSIONS } from "@/lib/tone";
import {
  EXPECTED_LABEL,
  VERDICT_LABEL,
  evaluateMatch,
  type Probe,
  type ProbeResult,
} from "@/lib/refusal";
import { SCORE_MAX, caseScore } from "@/lib/evals";

type Status =
  | { kind: "loading" }
  | { kind: "missing" }
  | { kind: "found"; artifact: Artifact };

export function ArtifactView({
  handle,
  slug,
}: {
  handle: string;
  slug: string;
}) {
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const backend = getArtifactBackend();
      const a = await backend.get(handle, slug);
      if (cancelled) return;
      setStatus(a ? { kind: "found", artifact: a } : { kind: "missing" });
    }
    load();
    const refresh = () => load();
    window.addEventListener(ARTIFACTS_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      cancelled = true;
      window.removeEventListener(ARTIFACTS_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, [handle, slug]);

  if (status.kind === "loading") {
    return (
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Loading…
      </p>
    );
  }

  if (status.kind === "missing") {
    return <MissingState handle={handle} slug={slug} />;
  }

  const a = status.artifact;
  return (
    <div className="flex flex-col gap-10">
      <Header artifact={a} />
      <ArtifactBody artifact={a} />
      <Footer artifact={a} />
    </div>
  );
}

function MissingState({ handle, slug }: { handle: string; slug: string }) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-8 md:p-12 hatched">
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Not found in this browser
      </p>
      <h1 className="font-display text-[28px] md:text-[34px] leading-[1.15] text-ink mt-3">
        <span className="font-mono text-[20px] md:text-[24px] text-ink-quiet">
          /p/{handle}/{slug}
        </span>
      </h1>
      <p className="font-sans text-[14px] text-ink-muted mt-4 max-w-md">
        Published artifacts currently live in localStorage only. Once Supabase
        is wired up, these URLs will work cross-device — for now, this
        artifact only exists in the browser that published it.
      </p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Link
          href="/notebook"
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink/90 transition-colors"
        >
          Open Notebook
          <span className="text-highlight">→</span>
        </Link>
        <Link
          href="/play"
          className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Browse playgrounds
        </Link>
      </div>
    </div>
  );
}

function Header({ artifact: a }: { artifact: Artifact }) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <KindPill kind={a.kind} />
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            {a.visibility === "private" ? "Private" : "Public"}
          </span>
        </div>
        <SaveAsPdfButton />
      </div>
      <h1 className="font-display text-[44px] md:text-[64px] leading-[1.02] tracking-tight text-ink mt-4">
        {a.title}
      </h1>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mt-4">
        by{" "}
        <Link
          href={`/p/${a.handle}`}
          className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          {a.handle}
        </Link>{" "}
        · {new Date(a.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
      </p>
      {a.summary && (
        <p className="font-sans text-[18px] leading-[1.55] text-ink mt-6 max-w-2xl">
          {a.summary}
        </p>
      )}
    </div>
  );
}

function SaveAsPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      data-print-hide
      className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink border border-line rounded-full px-3 py-1"
    >
      Save as PDF
    </button>
  );
}

function Footer({ artifact: a }: { artifact: Artifact }) {
  return (
    <div className="pt-8 border-t border-line flex flex-wrap items-center justify-between gap-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Published from Shape · /p/{a.handle}/{a.slug}
      </p>
      <Link
        href="/play"
        data-print-hide
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
      >
        Try a playground →
      </Link>
    </div>
  );
}

function KindPill({ kind }: { kind: Artifact["kind"] }) {
  const label =
    kind === "diff"
      ? "Diff Log"
      : kind === "tone"
      ? "Behavior Spec"
      : kind === "persona"
      ? "Persona Card"
      : kind === "refusal"
      ? "Refusal Scorecard"
      : kind === "evals"
      ? "Eval Scorecard"
      : kind === "case-study"
      ? "Case Study"
      : "Conversation";
  return (
    <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink bg-highlight-soft rounded-full px-2 py-0.5">
      {label}
    </span>
  );
}

function ArtifactBody({ artifact: a }: { artifact: Artifact }) {
  const d = a.draft;
  if (d.kind === "diff") return <DiffBody draft={d} />;
  if (d.kind === "tone") return <ToneBody draft={d} />;
  if (d.kind === "persona") return <PersonaBody draft={d} />;
  if (d.kind === "refusal") return <RefusalBody draft={d} />;
  if (d.kind === "evals") return <EvalsBody draft={d} />;
  if (d.kind === "case-study") return <CaseStudyBody draft={d} />;
  return <ChoreographerBody draft={d} />;
}

/* ---------------------------------------------------------------------- */
/* Per-kind renderers — read-only views of the draft snapshot.            */
/* ---------------------------------------------------------------------- */

function DiffBody({ draft }: { draft: Extract<Artifact["draft"], { kind: "diff" }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ConfigBox label="Config A" config={draft.configA} />
        <ConfigBox label="Config B" config={draft.configB} />
      </div>
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-3">
          Session log — {draft.turns.length}{" "}
          {draft.turns.length === 1 ? "turn" : "turns"}
        </p>
        <div className="flex flex-col gap-3">
          {draft.turns.map((t, i) => (
            <div key={t.id} className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
              <div className="flex items-baseline gap-3 pb-3 border-b border-line">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
                  Turn {i + 1}
                </span>
                <p className="font-sans text-[14px] leading-[1.5] text-ink min-w-0">
                  {t.userMessage}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                <OutputBlock label="A" model={modelName(draft.configA.provider, draft.configA.model)} text={t.outputA.text} />
                <OutputBlock label="B" model={modelName(draft.configB.provider, draft.configB.model)} text={t.outputB.text} />
              </div>
              {t.note && (
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                    Note
                  </p>
                  <p className="font-sans text-[14px] leading-[1.55] text-ink whitespace-pre-wrap">
                    {t.note}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ToneBody({ draft }: { draft: Extract<Artifact["draft"], { kind: "tone" }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
          Brief
        </p>
        <p className="font-sans text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">
          {draft.brief}
        </p>
      </div>
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-3">
          Tone dials
        </p>
        <ul className="flex flex-col gap-2">
          {TONE_DIMENSIONS.map((dim) => {
            const stop = draft.tone[dim.id];
            const isNeutral = stop === 0;
            const stopLabel = dim.stops[stop + 2].label;
            return (
              <li key={dim.id} className="flex items-center justify-between gap-3 font-mono text-[12px]">
                <span className="text-ink">{dim.label}</span>
                <span className={isNeutral ? "text-ink-quiet" : "text-highlight-ink"}>
                  {stopLabel}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
      {draft.lastOutput && (
        <div className="bg-surface border border-line rounded-[14px] p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
            Sample output
          </p>
          <p className="font-sans text-[15px] leading-[1.55] text-ink italic">
            &ldquo;{draft.lastOutput}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function PersonaBody({ draft }: { draft: Extract<Artifact["draft"], { kind: "persona" }> }) {
  const p = draft.persona;
  const fields: { label: string; value: string }[] = [
    { label: "Name", value: p.name },
    { label: "Role", value: p.role },
    { label: "Backstory", value: p.backstory },
    { label: "Core beliefs", value: p.beliefs },
    { label: "Voice", value: p.voice },
    { label: "Won't discuss", value: p.wontDiscuss },
    { label: "Strengths", value: p.strengths },
  ];
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 md:p-6 flex flex-col gap-4">
      {fields.map((f) =>
        f.value.trim() ? (
          <div key={f.label}>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
              {f.label}
            </p>
            <p className="font-sans text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">
              {f.value}
            </p>
          </div>
        ) : null,
      )}
      {draft.lastOutput && (
        <div className="border-t border-line pt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
            Sample output
          </p>
          <p className="font-sans text-[15px] leading-[1.55] text-ink italic">
            &ldquo;{draft.lastOutput}&rdquo;
          </p>
        </div>
      )}
    </div>
  );
}

function RefusalBody({ draft }: { draft: Extract<Artifact["draft"], { kind: "refusal" }> }) {
  let matched = 0;
  let scored = 0;
  for (const probe of draft.probes) {
    const r = draft.results[probe.id];
    const m = evaluateMatch(probe.expected, r?.verdict ?? null);
    if (m !== "pending") scored += 1;
    if (m === "match") matched += 1;
  }
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
          Refusal guidelines
        </p>
        <p className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap">
          {draft.guidelines}
        </p>
      </div>
      <div className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Scorecard — <span className="text-ink">{matched}/{draft.probes.length} match</span>
        {scored < draft.probes.length && (
          <span className="ml-2">
            ({draft.probes.length - scored} unscored)
          </span>
        )}
      </div>
      <div className="flex flex-col gap-3">
        {draft.probes.map((probe, i) => {
          const r = draft.results[probe.id];
          return <RefusalProbeView key={probe.id} num={i + 1} probe={probe} result={r} />;
        })}
      </div>
    </div>
  );
}

function RefusalProbeView({
  num,
  probe,
  result,
}: {
  num: number;
  probe: Probe;
  result: ProbeResult | undefined;
}) {
  const match = evaluateMatch(probe.expected, result?.verdict ?? null);
  return (
    <div className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-baseline gap-3 min-w-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
            Probe {num}
          </span>
          <span className="font-display text-[16px] leading-[1.2] text-ink truncate">
            {probe.label}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Expected
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
            {EXPECTED_LABEL[probe.expected]}
          </span>
          {result?.verdict && match !== "pending" && (
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.08em] inline-flex items-center gap-1.5 ${
                match === "match" ? "text-success" : "text-danger"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  match === "match" ? "bg-success" : "bg-danger"
                }`}
              />
              {match === "match" ? "Match" : "Mismatch"}
            </span>
          )}
        </div>
      </div>
      <div className="mt-3">
        <p className="font-sans text-[14px] leading-[1.5] text-ink italic">
          &ldquo;{probe.userMessage}&rdquo;
        </p>
      </div>
      {result?.output && (
        <div className="mt-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
            Output
          </p>
          <p className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap">
            {result.output}
          </p>
        </div>
      )}
      {result?.verdict && (
        <div className="mt-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            Verdict — <span className="text-ink-muted">{VERDICT_LABEL[result.verdict]}</span>
          </p>
        </div>
      )}
      {result?.note && (
        <p className="mt-2 font-sans text-[13px] leading-[1.55] text-ink-muted">
          {result.note}
        </p>
      )}
    </div>
  );
}

function EvalsBody({ draft }: { draft: Extract<Artifact["draft"], { kind: "evals" }> }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
          System prompt under test
        </p>
        <p className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap">
          {draft.systemPrompt}
        </p>
      </div>
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-3">
          Rubric
        </p>
        <ul className="flex flex-col gap-2">
          {draft.rubric.map((c) => (
            <li key={c.id} className="font-mono text-[12px] leading-[1.55]">
              <span className="text-ink">{c.name}</span>
              {c.description && (
                <span className="text-ink-quiet"> — {c.description}</span>
              )}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        {draft.cases.map((c, i) => {
          const r = draft.results[c.id];
          const score = r ? caseScore(draft.rubric, r) : null;
          return (
            <div key={c.id} className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-3 pb-3 border-b border-line">
                <div className="flex items-baseline gap-3 min-w-0">
                  <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet shrink-0">
                    Case {i + 1}
                  </span>
                  <span className="font-display text-[16px] leading-[1.2] text-ink truncate">
                    {c.label}
                  </span>
                </div>
                {score && (
                  <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted shrink-0">
                    <span className="text-ink">{score.total}</span>
                    <span className="text-ink-quiet">/{score.max}</span>
                  </span>
                )}
              </div>
              <p className="mt-3 font-sans text-[14px] leading-[1.5] text-ink italic">
                &ldquo;{c.userMessage}&rdquo;
              </p>
              {r?.output && (
                <div className="mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                    Output
                  </p>
                  <p className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap">
                    {r.output}
                  </p>
                </div>
              )}
              {r && Object.keys(r.scores).length > 0 && (
                <div className="mt-4 pt-3 border-t border-line">
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
                    Scores
                  </p>
                  <ul className="flex flex-col gap-1">
                    {draft.rubric.map((crit) => {
                      const s = r.scores[crit.id];
                      if (typeof s !== "number") return null;
                      return (
                        <li key={crit.id} className="flex items-center justify-between gap-3 font-mono text-[11px]">
                          <span className="text-ink-muted uppercase tracking-[0.08em]">
                            {crit.name}
                          </span>
                          <span className="text-ink">
                            {s}
                            <span className="text-ink-quiet">/{SCORE_MAX}</span>
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
              {r?.note && (
                <p className="mt-3 font-sans text-[13px] leading-[1.55] text-ink-muted">
                  {r.note}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChoreographerBody({
  draft,
}: {
  draft: Extract<Artifact["draft"], { kind: "choreographer" }>;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="bg-surface border border-line rounded-[14px] p-5">
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
          System prompt
        </p>
        <p className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap">
          {draft.systemPrompt}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        {draft.turns.map((t, i) => (
          <div key={t.id} className="bg-surface border border-line rounded-[14px] p-4 md:p-5">
            <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
              Turn {i + 1}
            </span>
            <div className="mt-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                User
              </p>
              <p className="font-sans text-[14px] leading-[1.55] text-ink whitespace-pre-wrap">
                {t.userMessage}
              </p>
            </div>
            {t.assistant.text && (
              <div className="mt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                  Assistant
                </p>
                <p className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap">
                  {t.assistant.text}
                </p>
              </div>
            )}
            {t.assistant.note && (
              <div className="mt-4 pt-3 border-t border-line">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                  Note
                </p>
                <p className="font-sans text-[14px] leading-[1.55] text-ink whitespace-pre-wrap">
                  {t.assistant.note}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfigBox({
  label,
  config,
}: {
  label: string;
  config: { provider: string; model: string; system: string; temperature: number };
}) {
  return (
    <div className="bg-surface border border-line rounded-[14px] p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          {label}
        </span>
        <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
          {modelName(config.provider, config.model)}
        </span>
      </div>
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
          System prompt
        </p>
        <p className="font-mono text-[12px] leading-[1.55] text-ink whitespace-pre-wrap">
          {config.system}
        </p>
      </div>
      <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Temperature — <span className="text-ink-muted">{config.temperature.toFixed(2)}</span>
      </p>
    </div>
  );
}

function OutputBlock({
  label,
  model,
  text,
}: {
  label: string;
  model: string;
  text: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {label}
        </span>
        <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
          {model}
        </span>
      </div>
      <p className="font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap">
        {text || (
          <span className="text-ink-quiet italic">—</span>
        )}
      </p>
    </div>
  );
}

function modelName(provider: string, model: string): string {
  const p = PROVIDERS[provider as keyof typeof PROVIDERS];
  return p?.models.find((m) => m.id === model)?.name ?? model;
}

function CaseStudyBody({
  draft,
}: {
  draft: Extract<Artifact["draft"], { kind: "case-study" }>;
}) {
  const p = draft.persona;
  const personaFields: { label: string; value: string }[] = [
    { label: "Name", value: p.name },
    { label: "Role", value: p.role },
    { label: "Backstory", value: p.backstory },
    { label: "Core beliefs", value: p.beliefs },
    { label: "Voice", value: p.voice },
    { label: "Won't discuss", value: p.wontDiscuss },
    { label: "Strengths", value: p.strengths },
  ];
  const activeTone = TONE_DIMENSIONS.map((dim) => {
    const stop = draft.tone[dim.id];
    return {
      id: dim.id,
      label: dim.label,
      stopLabel: dim.stops[stop + 2].label,
      neutral: stop === 0,
    };
  });
  return (
    <div className="flex flex-col gap-10">
      <CaseSection num="01" label="Brief">
        <p className="font-sans text-[16px] leading-[1.6] text-ink whitespace-pre-wrap">
          {draft.brief}
        </p>
        {draft.audience.trim() && (
          <div className="mt-5 pt-5 border-t border-line">
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
              Audience
            </p>
            <p className="font-sans text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">
              {draft.audience}
            </p>
          </div>
        )}
      </CaseSection>

      <CaseSection num="02" label="Approach — persona">
        <div className="flex flex-col gap-4">
          {personaFields.map((f) =>
            f.value.trim() ? (
              <div key={f.label}>
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-1">
                  {f.label}
                </p>
                <p className="font-sans text-[15px] leading-[1.55] text-ink whitespace-pre-wrap">
                  {f.value}
                </p>
              </div>
            ) : null,
          )}
        </div>
      </CaseSection>

      <CaseSection num="03" label="Approach — voice">
        <ul className="flex flex-col gap-2">
          {activeTone.map((t) => (
            <li
              key={t.id}
              className="flex items-center justify-between gap-3 font-mono text-[12px]"
            >
              <span className="text-ink">{t.label}</span>
              <span
                className={
                  t.neutral ? "text-ink-quiet" : "text-highlight-ink"
                }
              >
                {t.stopLabel}
              </span>
            </li>
          ))}
        </ul>
      </CaseSection>

      <CaseSection num="04" label="Sample exchange">
        <div className="flex flex-col gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
              User
            </p>
            <p className="font-sans text-[15px] leading-[1.55] text-ink italic">
              &ldquo;{draft.sample.userMessage}&rdquo;
            </p>
          </div>
          {draft.sample.output ? (
            <div className="border-t border-line pt-4">
              <div className="flex items-center justify-between mb-2">
                <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                  Assistant — {modelName(draft.provider, draft.model)}
                </p>
                {draft.sample.outputTokens !== undefined && (
                  <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                    {draft.sample.outputTokens} tok
                  </p>
                )}
              </div>
              <p className="font-mono text-[13px] leading-[1.6] text-ink whitespace-pre-wrap">
                {draft.sample.output}
              </p>
            </div>
          ) : (
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              No sample captured yet.
            </p>
          )}
        </div>
      </CaseSection>

      {draft.reflection.trim() && (
        <CaseSection num="05" label="Reflection">
          <p className="font-sans text-[16px] leading-[1.65] text-ink whitespace-pre-wrap">
            {draft.reflection}
          </p>
        </CaseSection>
      )}
    </div>
  );
}

function CaseSection({
  num,
  label,
  children,
}: {
  num: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-3 font-mono text-[12px] uppercase tracking-[0.08em] text-ink-quiet">
        <span>{num}</span>
        <span>—&nbsp;{label}</span>
      </div>
      <div className="mt-5 bg-surface border border-line rounded-[14px] p-5 md:p-6">
        {children}
      </div>
    </section>
  );
}
