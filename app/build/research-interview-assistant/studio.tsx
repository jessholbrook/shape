"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, type ProviderId } from "@/lib/providers";
import { composePersonaPrompt, type PersonaValues } from "@/lib/persona";
import { composeToneBlock, type ToneValues } from "@/lib/tone";
import { suggestTitle, type CaseStudyDraft } from "@/lib/drafts";
import { STUDIO_STEPS, type Studio, type StudioStepId } from "@/lib/studio";
import { PersonaForm } from "@/components/play/persona-form";
import { ToneDialControls } from "@/components/play/tone-dial-controls";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";

type Sample = {
  userMessage: string;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
};

type StreamStatus = "idle" | "running" | "done" | "error";

export function Studio({ studio }: { studio: Studio }) {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [stepId, setStepId] = useState<StudioStepId>("brief");

  const [provider, setProvider] = useState<ProviderId>("anthropic");
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.defaultModel);
  const [temperature, setTemperature] = useState(0.7);

  const [brief, setBrief] = useState(studio.defaults.brief);
  const [audience, setAudience] = useState(studio.defaults.audience);
  const [persona, setPersona] = useState<PersonaValues>(studio.defaults.persona);
  const [tone, setTone] = useState<ToneValues>(studio.defaults.tone);
  const [sample, setSample] = useState<Sample>({
    userMessage: studio.defaults.sampleMessage,
  });
  const [reflection, setReflection] = useState("");

  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const [streamError, setStreamError] = useState<string | null>(null);

  const hydrateFromDraft = useCallback((d: CaseStudyDraft) => {
    setProvider(d.provider);
    setModel(d.model);
    setTemperature(d.temperature);
    setBrief(d.brief);
    setAudience(d.audience);
    setPersona(d.persona);
    setTone(d.tone);
    setSample({
      userMessage: d.sample.userMessage,
      output: d.sample.output,
      inputTokens: d.sample.inputTokens,
      outputTokens: d.sample.outputTokens,
      costUsd: d.sample.costUsd,
    });
    setReflection(d.reflection);
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: `/build/${studio.id}`,
    kind: "case-study",
    apply: hydrateFromDraft,
  });

  const composedSystem = useMemo(() => {
    const personaPart = composePersonaPrompt(persona);
    const tonePart = composeToneBlock(tone);
    return [personaPart, tonePart].filter(Boolean).join("\n\n");
  }, [persona, tone]);

  const ready = hydrated && !!keys[provider];

  const personaReady = !!persona.name.trim() && !!persona.role.trim();
  const briefReady = brief.trim().length > 20;

  function persistDraft() {
    return save({
      studioId: studio.id,
      title:
        title.trim() ||
        suggestTitle(brief, `${studio.title} case study`),
      provider,
      model,
      temperature,
      brief,
      audience,
      persona,
      tone,
      sample,
      reflection,
    });
  }

  async function runSample() {
    const apiKey = keys[provider];
    if (!apiKey) return;
    const userMessage = sample.userMessage.trim();
    if (!userMessage) return;

    setStreamStatus("running");
    setStreamError(null);
    setSample((s) => ({
      ...s,
      output: "",
      inputTokens: undefined,
      outputTokens: undefined,
      costUsd: undefined,
    }));

    try {
      const stream = runChat({
        provider,
        model,
        system: composedSystem,
        messages: [{ role: "user", content: userMessage }],
        temperature,
        apiKey,
      });
      let accumulated = "";
      for await (const event of stream) {
        if (event.type === "text") {
          accumulated += event.delta;
          setSample((s) => ({ ...s, output: accumulated }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          setSample((s) => ({
            ...s,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
          }));
          recordUsage({
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
          setStreamStatus("done");
        } else if (event.type === "error") {
          setStreamError(event.message);
          setStreamStatus("error");
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setStreamError(message);
      setStreamStatus("error");
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !ready}
        providerName={PROVIDERS[provider].name}
        action="test the assistant"
      />

      <StepNav current={stepId} onSelect={setStepId} />

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      {stepId === "brief" && (
        <BriefStep
          brief={brief}
          audience={audience}
          onBriefChange={setBrief}
          onAudienceChange={setAudience}
        />
      )}

      {stepId === "design" && (
        <DesignStep
          persona={persona}
          tone={tone}
          composedSystem={composedSystem}
          personaReady={personaReady}
          onPersonaChange={setPersona}
          onToneChange={setTone}
        />
      )}

      {stepId === "test" && (
        <TestStep
          sample={sample}
          composedSystem={composedSystem}
          status={streamStatus}
          error={streamError}
          provider={provider}
          model={model}
          canRun={ready && !!sample.userMessage.trim() && personaReady}
          running={streamStatus === "running"}
          onSampleMessageChange={(m) =>
            setSample((s) => ({ ...s, userMessage: m }))
          }
          onRun={runSample}
        />
      )}

      {stepId === "reflect" && (
        <ReflectStep
          reflection={reflection}
          briefReady={briefReady}
          personaReady={personaReady}
          hasSample={!!sample.output}
          onReflectionChange={setReflection}
          onSave={persistDraft}
        />
      )}

      <StepFooter current={stepId} onSelect={setStepId} />

      <DraftSaveBar
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={persistDraft}
      />
    </div>
  );
}

function StepNav({
  current,
  onSelect,
}: {
  current: StudioStepId;
  onSelect: (id: StudioStepId) => void;
}) {
  const currentIndex = STUDIO_STEPS.findIndex((s) => s.id === current);
  return (
    <div className="bg-surface border border-line rounded-[16px] p-3 grid grid-cols-2 md:grid-cols-4 gap-2">
      {STUDIO_STEPS.map((s, i) => {
        const active = s.id === current;
        const done = i < currentIndex;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={`flex flex-col items-start gap-1 rounded-[12px] px-3 py-2 text-left transition-colors ${
              active
                ? "bg-ink text-canvas"
                : "hover:bg-line/40 text-ink"
            }`}
          >
            <span
              className={`font-mono text-[10px] uppercase tracking-[0.1em] ${
                active
                  ? "text-canvas/70"
                  : done
                  ? "text-success"
                  : "text-ink-quiet"
              }`}
            >
              {done ? "✓ " : ""}
              {s.num}
            </span>
            <span className="font-sans text-[14px] leading-[1.2]">
              {s.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepFooter({
  current,
  onSelect,
}: {
  current: StudioStepId;
  onSelect: (id: StudioStepId) => void;
}) {
  const i = STUDIO_STEPS.findIndex((s) => s.id === current);
  const prev = i > 0 ? STUDIO_STEPS[i - 1] : null;
  const next = i < STUDIO_STEPS.length - 1 ? STUDIO_STEPS[i + 1] : null;
  return (
    <div className="flex items-center justify-between gap-3">
      {prev ? (
        <button
          type="button"
          onClick={() => onSelect(prev.id)}
          className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          ← {prev.label}
        </button>
      ) : (
        <span />
      )}
      {next ? (
        <button
          type="button"
          onClick={() => onSelect(next.id)}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] hover:bg-ink/90 transition-colors"
        >
          {next.label}
          <span className="text-highlight">→</span>
        </button>
      ) : null}
    </div>
  );
}

function StepShell({
  num,
  label,
  blurb,
  children,
}: {
  num: string;
  label: string;
  blurb: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <span className="font-mono text-[11px] uppercase tracking-[0.1em] text-ink-quiet">
          Step {num}
        </span>
        <h2 className="font-display text-[32px] md:text-[40px] leading-[1.1] tracking-tight text-ink mt-2">
          {label}
        </h2>
        <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-3 max-w-2xl">
          {blurb}
        </p>
      </div>
      {children}
    </div>
  );
}

function BriefStep({
  brief,
  audience,
  onBriefChange,
  onAudienceChange,
}: {
  brief: string;
  audience: string;
  onBriefChange: (v: string) => void;
  onAudienceChange: (v: string) => void;
}) {
  return (
    <StepShell
      num={STUDIO_STEPS[0].num}
      label="Frame the brief"
      blurb={STUDIO_STEPS[0].blurb}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LongField
          label="Problem"
          hint="What problem are you solving with this assistant? Two or three sentences."
          rows={6}
          value={brief}
          onChange={onBriefChange}
          placeholder="An assistant that helps designers ask better interview questions…"
        />
        <LongField
          label="Audience"
          hint="Who is this for, and when do they reach for it?"
          rows={6}
          value={audience}
          onChange={onAudienceChange}
          placeholder="Junior UX designers preparing for their first interview round."
        />
      </div>
    </StepShell>
  );
}

function DesignStep({
  persona,
  tone,
  composedSystem,
  personaReady,
  onPersonaChange,
  onToneChange,
}: {
  persona: PersonaValues;
  tone: ToneValues;
  composedSystem: string;
  personaReady: boolean;
  onPersonaChange: (next: PersonaValues) => void;
  onToneChange: (next: ToneValues) => void;
}) {
  return (
    <StepShell
      num={STUDIO_STEPS[1].num}
      label="Design the assistant"
      blurb={STUDIO_STEPS[1].blurb}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <PersonaForm values={persona} onChange={onPersonaChange} />
        <div className="flex flex-col gap-4">
          <ToneDialControls values={tone} onChange={onToneChange} />
          <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[200px]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Composed system prompt
              </span>
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
                {personaReady ? "Live" : "Needs name + role"}
              </span>
            </div>
            <div className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
              {composedSystem ? (
                composedSystem
              ) : (
                <span className="text-ink-quiet italic">
                  Fill in name + role to compose a prompt.
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </StepShell>
  );
}

function TestStep({
  sample,
  composedSystem,
  status,
  error,
  provider,
  model,
  canRun,
  running,
  onSampleMessageChange,
  onRun,
}: {
  sample: Sample;
  composedSystem: string;
  status: StreamStatus;
  error: string | null;
  provider: ProviderId;
  model: string;
  canRun: boolean;
  running: boolean;
  onSampleMessageChange: (m: string) => void;
  onRun: () => void;
}) {
  const modelName =
    PROVIDERS[provider].models.find((m) => m.id === model)?.name ?? model;
  return (
    <StepShell
      num={STUDIO_STEPS[2].num}
      label="Test the assistant"
      blurb={STUDIO_STEPS[2].blurb}
    >
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          Ask the assistant
        </label>
        <textarea
          value={sample.userMessage}
          onChange={(e) => onSampleMessageChange(e.target.value)}
          rows={3}
          placeholder="A real question someone in your audience would ask."
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRun}
            disabled={!canRun || running}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Streaming…" : "Run sample"}
            <span className="text-highlight">→</span>
          </button>
          {!canRun && !running && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Needs name + role + key
            </span>
          )}
        </div>
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[260px]">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
              Sample output
            </span>
            <span className="font-mono text-[10px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
              {modelName}
            </span>
          </div>
          <StatusPill status={status} />
        </div>

        <div className="flex-1 font-mono text-[13px] leading-[1.55] text-ink whitespace-pre-wrap break-words min-h-[180px]">
          {error ? (
            <span className="text-danger">{error}</span>
          ) : sample.output ? (
            <>
              {sample.output}
              {running && (
                <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
              )}
            </>
          ) : (
            <span className="text-ink-quiet italic">
              Output will stream here.
            </span>
          )}
        </div>

        {sample.output && sample.outputTokens !== undefined && (
          <div className="border-t border-line pt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            <span>in {sample.inputTokens ?? 0} tok</span>
            <span>out {sample.outputTokens} tok</span>
            <span className="text-ink">
              {(sample.costUsd ?? 0) < 0.01
                ? "<$0.01"
                : `$${(sample.costUsd ?? 0).toFixed(3)}`}
            </span>
          </div>
        )}
      </div>

      {composedSystem && (
        <details className="bg-surface border border-line rounded-[16px] p-5">
          <summary className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet cursor-pointer">
            System prompt used
          </summary>
          <p className="mt-3 font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
            {composedSystem}
          </p>
        </details>
      )}
    </StepShell>
  );
}

function ReflectStep({
  reflection,
  briefReady,
  personaReady,
  hasSample,
  onReflectionChange,
  onSave,
}: {
  reflection: string;
  briefReady: boolean;
  personaReady: boolean;
  hasSample: boolean;
  onReflectionChange: (v: string) => void;
  onSave: () => void;
}) {
  const ready = briefReady && personaReady && hasSample;
  return (
    <StepShell
      num={STUDIO_STEPS[3].num}
      label="Reflect and save"
      blurb={STUDIO_STEPS[3].blurb}
    >
      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          Reflection
        </label>
        <p className="font-mono text-[10px] text-ink-quiet mb-3">
          What worked, what didn&apos;t, what you&apos;d change next iteration.
          Three to six sentences.
        </p>
        <textarea
          value={reflection}
          onChange={(e) => onReflectionChange(e.target.value)}
          rows={8}
          placeholder="The assistant held the line on not suggesting leading questions, but it over-explained the rationale. Next pass: turn verbosity down a stop and add 'one suggestion per turn' to the system prompt…"
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-3">
          Ready to keep?
        </p>
        <ul className="flex flex-col gap-2 font-mono text-[12px]">
          <Check ok={briefReady}>Brief is at least a couple sentences</Check>
          <Check ok={personaReady}>Persona has a name and role</Check>
          <Check ok={hasSample}>You ran at least one sample</Check>
          <Check ok={reflection.trim().length > 30}>
            Reflection has some real content
          </Check>
        </ul>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] text-ink-quiet">
            Saves to your Notebook. Export from there.
          </p>
          <button
            type="button"
            onClick={onSave}
            disabled={!ready}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            Save Case Study
            <span className="text-highlight">→</span>
          </button>
        </div>
      </div>
    </StepShell>
  );
}

function Check({
  ok,
  children,
}: {
  ok: boolean;
  children: React.ReactNode;
}) {
  return (
    <li
      className={`inline-flex items-center gap-2 ${
        ok ? "text-ink" : "text-ink-quiet"
      }`}
    >
      <span
        className={`w-3 h-3 rounded-full ${
          ok ? "bg-success" : "border border-line bg-canvas"
        }`}
      />
      {children}
    </li>
  );
}

function LongField({
  label,
  hint,
  rows,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  hint: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
        {label}
      </span>
      <span className="font-mono text-[10px] text-ink-quiet leading-[1.5]">
        {hint}
      </span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y mt-1"
      />
    </div>
  );
}


function StatusPill({ status }: { status: StreamStatus }) {
  if (status === "idle")
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        Idle
      </span>
    );
  if (status === "running")
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-highlight-ink">
        <span className="w-1.5 h-1.5 rounded-full bg-highlight animate-pulse" />
        Streaming
      </span>
    );
  if (status === "done")
    return (
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Done
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-danger">
      <span className="w-1.5 h-1.5 rounded-full bg-danger" /> Error
    </span>
  );
}
