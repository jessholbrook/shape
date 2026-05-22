"use client";

import { useState } from "react";
import Link from "next/link";
import { useKeys } from "@/lib/hooks/use-keys";
import { runChat } from "@/lib/providers/index";
import { recordUsage, calcCost } from "@/lib/usage";
import { ConfigPanel, type ConfigState } from "@/components/play/config-panel";
import { OutputPanel, type OutputState } from "@/components/play/output-panel";

const INITIAL_A: ConfigState = {
  provider: "anthropic",
  model: "claude-sonnet-4-6",
  system: "You are a thoughtful UX writer. Be warm and concise.",
  temperature: 0.7,
};

const INITIAL_B: ConfigState = {
  provider: "openai",
  model: "gpt-4o",
  system: "You are a thoughtful UX writer. Be warm and concise.",
  temperature: 0.7,
};

const EMPTY_OUTPUT: OutputState = {
  text: "",
  status: "idle",
  inputTokens: 0,
  outputTokens: 0,
  costUsd: 0,
};

export function DiffMode() {
  const { keys, hydrated } = useKeys();
  const [configA, setConfigA] = useState<ConfigState>(INITIAL_A);
  const [configB, setConfigB] = useState<ConfigState>(INITIAL_B);
  const [userMessage, setUserMessage] = useState(
    "Write a one-sentence welcome message for a research interview tool.",
  );
  const [outputA, setOutputA] = useState<OutputState>(EMPTY_OUTPUT);
  const [outputB, setOutputB] = useState<OutputState>(EMPTY_OUTPUT);
  const [running, setRunning] = useState(false);

  const aReady = hydrated && !!keys[configA.provider];
  const bReady = hydrated && !!keys[configB.provider];
  const canRun = aReady && bReady && userMessage.trim() && !running;

  async function streamOne(
    config: ConfigState,
    setOutput: React.Dispatch<React.SetStateAction<OutputState>>,
  ) {
    const apiKey = keys[config.provider];
    if (!apiKey) {
      setOutput({
        ...EMPTY_OUTPUT,
        status: "error",
        error: `No key set for ${config.provider}.`,
      });
      return;
    }

    const startMs = Date.now();
    setOutput({
      ...EMPTY_OUTPUT,
      status: "running",
      startMs,
    });

    try {
      const stream = runChat({
        provider: config.provider,
        model: config.model,
        system: config.system,
        messages: [{ role: "user", content: userMessage }],
        temperature: config.temperature,
        apiKey,
      });

      for await (const event of stream) {
        if (event.type === "text") {
          setOutput((prev) => ({ ...prev, text: prev.text + event.delta }));
        } else if (event.type === "done") {
          const cost = calcCost(
            config.provider,
            config.model,
            event.usage.inputTokens,
            event.usage.outputTokens,
          );
          setOutput((prev) => ({
            ...prev,
            status: "done",
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
            costUsd: cost,
            endMs: Date.now(),
          }));
          recordUsage({
            provider: config.provider,
            model: config.model,
            inputTokens: event.usage.inputTokens,
            outputTokens: event.usage.outputTokens,
          });
        } else if (event.type === "error") {
          setOutput((prev) => ({
            ...prev,
            status: "error",
            error: event.message,
            endMs: Date.now(),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setOutput((prev) => ({
        ...prev,
        status: "error",
        error: message,
        endMs: Date.now(),
      }));
    }
  }

  async function runBoth() {
    setRunning(true);
    setOutputA({ ...EMPTY_OUTPUT, status: "running", startMs: Date.now() });
    setOutputB({ ...EMPTY_OUTPUT, status: "running", startMs: Date.now() });
    await Promise.all([
      streamOne(configA, setOutputA),
      streamOne(configB, setOutputB),
    ]);
    setRunning(false);
  }

  function reset() {
    setOutputA(EMPTY_OUTPUT);
    setOutputB(EMPTY_OUTPUT);
  }

  return (
    <div className="flex flex-col gap-6">
      {hydrated && (!aReady || !bReady) && (
        <div className="bg-highlight-soft border border-highlight/40 rounded-[12px] p-4 flex flex-wrap items-center justify-between gap-3">
          <p className="font-sans text-[14px] text-ink">
            You&apos;re missing a key for{" "}
            {!aReady && !bReady
              ? "both providers"
              : !aReady
              ? configA.provider
              : configB.provider}
            . Add one to run a diff.
          </p>
          <Link
            href="/settings/keys"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Set up keys →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ConfigPanel
          label="Config A"
          config={configA}
          onChange={setConfigA}
          connected={aReady}
        />
        <ConfigPanel
          label="Config B"
          config={configB}
          onChange={setConfigB}
          connected={bReady}
        />
      </div>

      <div className="bg-surface border border-line rounded-[16px] p-5">
        <label className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet block mb-2">
          User message
        </label>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={3}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
          placeholder="What do you want to send to both models?"
        />
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runBoth}
            disabled={!canRun}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            {running ? "Streaming…" : "Run both"}
            <span className="text-highlight">→</span>
          </button>
          <button
            type="button"
            onClick={reset}
            disabled={running}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <OutputPanel label="Output A" config={configA} output={outputA} />
        <OutputPanel label="Output B" config={configB} output={outputB} />
      </div>
    </div>
  );
}
