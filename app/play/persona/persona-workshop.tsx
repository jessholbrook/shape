"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useKeys } from "@/lib/hooks/use-keys";
import { useDraftEditing } from "@/lib/hooks/use-draft-editing";
import { useDefaultProvider } from "@/lib/hooks/use-default-provider";
import { useUnsavedWork } from "@/lib/hooks/use-unsaved-work";
import { runChat, type ChatMessage } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { PROVIDERS, providerNeedsKey, type ProviderId } from "@/lib/providers";
import {
  DEFAULT_PERSONA,
  EMPTY_PERSONA,
  composePersonaPrompt,
  composePersonaSections,
  isPersonaEmpty,
  type PersonaSection,
  type PersonaValues,
} from "@/lib/persona";
import { suggestTitle, type PersonaDraft } from "@/lib/drafts";
import { slugify, downloadBlob } from "@/lib/download";
import { REFLECTION } from "@/lib/reflection-questions";
import { PersonaForm } from "@/components/play/persona-form";
import { DraftSaveBar } from "@/components/play/draft-save-bar";
import { MissingKeyBanner } from "@/components/play/missing-key-banner";
import { ProviderModelTempRow } from "@/components/play/provider-model-temp-row";
import { ReflectionCard } from "@/components/play/reflection-card";
import { StreamingPlaceholder } from "@/components/play/streaming-placeholder";
import { WebLLMUnsupportedBanner } from "@/components/play/webllm-unsupported-banner";

type ReplyState = {
  text: string;
  status: "idle" | "running" | "done" | "error";
  error?: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  startMs?: number;
  endMs?: number;
};

const EMPTY_REPLY: ReplyState = {
  text: "",
  status: "idle",
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

const DEFAULT_MESSAGE =
  "Give me three opening questions to use in a workflow interview with a designer, and one thing to avoid.";

export function PersonaWorkshop() {
  const { keys, hydrated } = useKeys();
  const searchParams = useSearchParams();
  const initialDraftId = searchParams.get("draft");

  const [provider, setProvider] = useState<ProviderId>("webllm");
  const [model, setModel] = useState<string>(PROVIDERS.webllm.defaultModel);
  const [temperature, setTemperature] = useState(0.7);
  const [persona, setPersona] = useState<PersonaValues>(DEFAULT_PERSONA);
  const [userMessage, setUserMessage] = useState(DEFAULT_MESSAGE);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [reply, setReply] = useState<ReplyState>(EMPTY_REPLY);
  const [running, setRunning] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [reflectionDismissed, setReflectionDismissed] = useState(false);

  useUnsavedWork(dirty);

  const hydrateFromDraft = useCallback((draft: PersonaDraft) => {
    setProvider(draft.provider);
    setModel(draft.model);
    setTemperature(draft.temperature);
    setPersona(draft.persona);
    if (draft.transcript?.length) {
      setMessages(draft.transcript);
      setReply({ ...EMPTY_REPLY, status: "done" });
      setUserMessage("");
    } else if (draft.lastOutput) {
      // Pre-multi-turn draft: reconstruct the single exchange.
      setMessages([
        { role: "user", content: draft.lastUserMessage },
        { role: "assistant", content: draft.lastOutput },
      ]);
      setReply({ ...EMPTY_REPLY, status: "done" });
      setUserMessage("");
    } else {
      setUserMessage(draft.lastUserMessage);
    }
  }, []);
  const { draftId, title, setTitle, saveStatus, save } = useDraftEditing({
    initialDraftId,
    editorRoute: "/play/persona",
    kind: "persona",
    apply: hydrateFromDraft,
  });

  useDefaultProvider({
    enabled: !initialDraftId,
    onResolve: useCallback((p: ProviderId, m: string) => {
      setProvider(p);
      setModel(m);
    }, []),
  });

  const composedSystem = useMemo(
    () => composePersonaPrompt(persona),
    [persona],
  );
  const promptSections = useMemo(
    () => composePersonaSections(persona),
    [persona],
  );
  const personaEmpty = isPersonaEmpty(persona);

  const ready = hydrated && (!providerNeedsKey(provider) || !!keys[provider]);
  const canRun = ready && userMessage.trim() && !running && !personaEmpty;

  async function run() {
    const apiKey = keys[provider];
    if (providerNeedsKey(provider) && !apiKey) return;
    const question = userMessage.trim();
    if (!question) return;

    const history: ChatMessage[] = [
      ...messages,
      { role: "user", content: question },
    ];
    setMessages(history);
    setUserMessage("");
    setRunning(true);
    setDirty(true);
    setReply({ ...EMPTY_REPLY, status: "running", startMs: Date.now() });

    let acc = "";
    try {
      const stream = runChat({
        provider,
        model,
        system: composedSystem,
        messages: history,
        temperature,
        apiKey,
      });
      for await (const event of stream) {
        if (event.type === "text") {
          acc += event.delta;
          setReply((prev) => ({ ...prev, text: prev.text + event.delta }));
        } else if (event.type === "done") {
          const cost = calcCost(
            provider,
            model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          setMessages([...history, { role: "assistant", content: acc }]);
          setReply((prev) => ({
            ...prev,
            text: "",
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
            endMs: Date.now(),
          }));
          recordUsage({
            provider,
            model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          // Put the question back in the composer so retry is one click.
          setMessages(messages);
          setUserMessage(question);
          setReply((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setMessages(messages);
      setUserMessage(question);
      setReply((prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    } finally {
      setRunning(false);
    }
  }

  function clearConversation() {
    setMessages([]);
    setReply(EMPTY_REPLY);
    setUserMessage(DEFAULT_MESSAGE);
    setDirty(false);
    setReflectionDismissed(false);
  }

  function handleSaveDraft() {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    const lastAssistant = [...messages]
      .reverse()
      .find((m) => m.role === "assistant");
    save({
      title:
        title.trim() ||
        suggestTitle(persona.name || persona.role, "Untitled persona"),
      provider,
      model,
      temperature,
      persona,
      lastUserMessage: lastUser?.content ?? userMessage,
      lastOutput: lastAssistant?.content,
      transcript: messages.length ? messages : undefined,
    });
    setDirty(false);
  }

  const personaLabel = persona.name.trim() || "Persona";
  const hasConversation = messages.length > 0 || reply.status === "running";
  const assistantReplies = messages.filter((m) => m.role === "assistant").length;
  const showReflection =
    assistantReplies >= 2 && !running && !reflectionDismissed;

  return (
    <div className="flex flex-col gap-6">
      <MissingKeyBanner
        show={hydrated && !ready}
        providerName={PROVIDERS[provider].name}
        action="test the persona"
      />
      <WebLLMUnsupportedBanner show={provider === "webllm"} />

      <ProviderModelTempRow
        provider={provider}
        model={model}
        temperature={temperature}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onTemperatureChange={setTemperature}
      />

      {hasConversation && (
        <ConversationCard
          messages={messages}
          reply={reply}
          personaLabel={personaLabel}
          system={composedSystem}
          filenameStem={`persona-${slugify(persona.name || persona.role || title || "conversation", "conversation")}`}
          onClear={running ? undefined : clearConversation}
        />
      )}

      {showReflection && (
        <ReflectionCard
          reflection={REFLECTION.persona}
          onDismiss={() => setReflectionDismissed(true)}
        />
      )}

      {/* First-ask failures revert the (empty) transcript, so the error would
          otherwise have nowhere to render and the Ask button looks dead.
          Surface it here whenever there's no conversation card to hold it. */}
      {!hasConversation && reply.status === "error" && reply.error && (
        <div className="bg-danger/10 border border-danger/30 rounded-[12px] p-4">
          <p className="font-sans text-[14px] leading-[1.55] text-ink">
            {reply.error}
          </p>
        </div>
      )}

      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          {hasConversation ? "Continue the conversation" : "Ask the persona"}
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={2}
          placeholder={
            hasConversation
              ? "Follow up, push back, or change direction."
              : "Test the persona with a real question."
          }
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={run}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Streaming…" : hasConversation ? "Reply" : "Ask"}
            <span className="text-highlight">→</span>
          </button>
          {personaEmpty && (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
              Add a name or role below first
            </span>
          )}
        </div>
      </div>

      <div className="pt-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet mb-3">
          Design surface
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <PersonaForm
            values={persona}
            onChange={setPersona}
            onReset={() => setPersona(EMPTY_PERSONA)}
          />
          <ComposedPromptCard sections={promptSections} empty={personaEmpty} />
        </div>
      </div>

      <DraftSaveBar
        title={title}
        onTitleChange={setTitle}
        status={saveStatus}
        draftId={draftId}
        onSave={handleSaveDraft}
      />
    </div>
  );
}

function ConversationCard({
  messages,
  reply,
  personaLabel,
  system,
  filenameStem,
  onClear,
}: {
  messages: ChatMessage[];
  reply: ReplyState;
  personaLabel: string;
  system: string;
  filenameStem: string;
  onClear?: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const elapsed =
    reply.startMs && reply.endMs
      ? ((reply.endMs - reply.startMs) / 1000).toFixed(1) + "s"
      : null;

  function transcriptText(): string {
    return messages
      .map((m) => `${m.role === "user" ? "You" : personaLabel}: ${m.content}`)
      .join("\n\n");
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(transcriptText());
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* best effort */
    }
  }

  function download() {
    const date = new Date().toISOString().split("T")[0];
    const body = [
      `# Persona conversation — ${date}`,
      "",
      "## System prompt",
      "",
      "```",
      system,
      "```",
      "",
      "## Conversation",
      "",
      ...messages.map(
        (m) => `**${m.role === "user" ? "You" : personaLabel}:** ${m.content}\n`,
      ),
    ].join("\n");
    downloadBlob(`${filenameStem}-${date}.md`, "text/markdown", body);
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Conversation — {Math.ceil(messages.length / 2)}{" "}
          {messages.length > 2 ? "turns" : "turn"}
        </span>
        <div className="flex items-center gap-3">
          {messages.length > 0 && (
            <>
              <button
                type="button"
                onClick={copy}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                {copied ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={download}
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                Download
              </button>
            </>
          )}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet hover:text-danger"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {messages.map((m, i) => (
          <Message key={i} role={m.role} personaLabel={personaLabel}>
            {m.content}
          </Message>
        ))}
        {reply.status === "running" && (
          <Message role="assistant" personaLabel={personaLabel}>
            {reply.text || <StreamingPlaceholder />}
            {reply.text && (
              <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
            )}
          </Message>
        )}
        {reply.status === "error" && (
          <p className="font-mono text-[12px] leading-[1.55] text-danger">
            {reply.error}
          </p>
        )}
      </div>

      {reply.status === "done" &&
        (reply.inputTokens || reply.outputTokens || elapsed) && (
          <div className="border-t border-line pt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
            <span>Last reply</span>
            <span>in {reply.inputTokens} tok</span>
            <span>out {reply.outputTokens} tok</span>
            <span className="text-ink">
              {reply.costUsd < 0.01 ? "<$0.01" : `$${reply.costUsd.toFixed(3)}`}
            </span>
            {elapsed && <span>{elapsed}</span>}
          </div>
        )}
    </div>
  );
}

function Message({
  role,
  personaLabel,
  children,
}: {
  role: "user" | "assistant";
  personaLabel: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
        {role === "user" ? "You" : personaLabel}
      </span>
      <div
        className={`whitespace-pre-wrap break-words leading-[1.55] ${
          role === "user"
            ? "font-sans text-[14px] text-ink-muted"
            : "font-mono text-[13px] text-ink"
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function ComposedPromptCard({
  sections,
  empty,
}: {
  sections: PersonaSection[];
  empty: boolean;
}) {
  return (
    <div className="bg-surface border border-line rounded-[16px] p-5 flex flex-col gap-3 min-h-[280px]">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {empty ? "Scaffold" : "Composed system prompt"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {empty ? "Fill the blanks" : "Live"}
        </span>
      </div>

      {empty ? (
        <ScaffoldHint />
      ) : (
        <div className="flex flex-col gap-3">
          {sections.map((s) => (
            <div key={s.source} className="flex flex-col gap-1">
              <span
                className={`self-start font-mono text-[9px] uppercase tracking-[0.08em] rounded-full px-1.5 py-0.5 ${
                  s.source === "style"
                    ? "bg-line/60 text-ink-quiet"
                    : "bg-highlight-soft text-highlight-ink"
                }`}
              >
                {s.label}
              </span>
              <p className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
                {s.text}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ScaffoldHint() {
  return (
    <div className="flex flex-col gap-3">
      <p className="font-sans text-[13px] leading-[1.55] text-ink-muted">
        A persona is more than a name and a role. Fill these in left and the
        prompt composes here.
      </p>
      <div className="font-mono text-[12px] leading-[1.7] text-ink">
        <ScaffoldLine>
          You are <Blank label="Name" /> who&apos;s been{" "}
          <Blank label="Backstory" /> for <Blank label="Backstory" />.
        </ScaffoldLine>
        <ScaffoldLine>
          You believe <Blank label="Beliefs" /> because{" "}
          <Blank label="Beliefs" />.
        </ScaffoldLine>
        <ScaffoldLine>
          You won&apos;t <Blank label="Won't discuss" /> — instead you&apos;ll{" "}
          <Blank label="Strengths" />.
        </ScaffoldLine>
        <ScaffoldLine>
          Your voice is <Blank label="Voice" />, <Blank label="Voice" />,
          and <Blank label="Voice" />.
        </ScaffoldLine>
      </div>
    </div>
  );
}

function ScaffoldLine({ children }: { children: React.ReactNode }) {
  return <p className="mb-1">{children}</p>;
}

function Blank({ label }: { label: string }) {
  return (
    <span className="bg-highlight-soft text-highlight-ink rounded-sm px-1.5 py-0.5 font-sans text-[11px] uppercase tracking-[0.08em]">
      {label}
    </span>
  );
}
