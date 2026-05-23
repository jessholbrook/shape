"use client";

import { useState } from "react";
import type { Artifact } from "@/lib/artifacts";
import { DEMO_MODEL, isDemoableKind } from "@/lib/demo";

type Status =
  | { kind: "idle" }
  | { kind: "running"; output: string }
  | {
      kind: "done";
      output: string;
      remainingArtifact?: number;
      remainingIp?: number;
    }
  | { kind: "error"; message: string };

export function TryIt({ artifact }: { artifact: Artifact }) {
  const [userMessage, setUserMessage] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  if (!isDemoableKind(artifact.kind)) return null;
  if (artifact.visibility !== "public") return null;

  async function run() {
    const message = userMessage.trim();
    if (!message) return;
    setStatus({ kind: "running", output: "" });

    let res: Response;
    try {
      res = await fetch("/api/demo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle: artifact.handle,
          slug: artifact.slug,
          userMessage: message,
        }),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message: m });
      return;
    }

    if (!res.ok) {
      let m = `Demo request failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error?.message) m = j.error.message;
      } catch {
        /* ignore */
      }
      setStatus({ kind: "error", message: m });
      return;
    }
    if (!res.body) {
      setStatus({ kind: "error", message: "Demo response had no body." });
      return;
    }

    const remainingArtifact = numHeader(
      res.headers.get("x-shape-demo-remaining-artifact"),
    );
    const remainingIp = numHeader(res.headers.get("x-shape-demo-remaining-ip"));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let output = "";

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split("\n\n");
        buffer = events.pop() ?? "";
        for (const block of events) {
          for (const line of block.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const parsed = JSON.parse(payload) as {
                type?: string;
                delta?: { type?: string; text?: string };
              };
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                typeof parsed.delta.text === "string"
              ) {
                output += parsed.delta.text;
                setStatus({ kind: "running", output });
              }
            } catch {
              /* ignore non-JSON frames */
            }
          }
        }
      }
      setStatus({
        kind: "done",
        output,
        remainingArtifact,
        remainingIp,
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message: m });
    }
  }

  function reset() {
    setStatus({ kind: "idle" });
    setUserMessage("");
  }

  const running = status.kind === "running";
  const output =
    status.kind === "running" || status.kind === "done" ? status.output : "";
  const remainingArtifact =
    status.kind === "done" ? status.remainingArtifact : undefined;

  return (
    <div
      data-print-hide
      className="bg-surface border border-line rounded-[16px] p-5 md:p-6 flex flex-col gap-4"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-highlight-ink">
          Try it
        </p>
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          Demo mode — {DEMO_MODEL}. Bring your own key for the original model.
        </p>
      </div>

      <label className="flex flex-col gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
          Ask the assistant
        </span>
        <textarea
          value={userMessage}
          onChange={(e) => setUserMessage(e.target.value)}
          rows={3}
          placeholder="A real question — see how this assistant responds."
          disabled={running}
          className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.55] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y disabled:opacity-60"
        />
      </label>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={run}
          disabled={running || !userMessage.trim()}
          className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
        >
          {running ? "Streaming…" : "Run demo"}
          <span className="text-highlight">→</span>
        </button>
        {status.kind === "done" && (
          <button
            type="button"
            onClick={reset}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Try another question
          </button>
        )}
      </div>

      {(output || status.kind === "error") && (
        <div className="border-t border-line pt-4 min-h-[120px]">
          {status.kind === "error" ? (
            <p className="font-sans text-[14px] leading-[1.55] text-danger whitespace-pre-wrap">
              {status.message}
            </p>
          ) : (
            <>
              <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
                Output
              </p>
              <p className="font-mono text-[13px] leading-[1.6] text-ink whitespace-pre-wrap break-words">
                {output}
                {running && (
                  <span className="inline-block w-2 h-4 align-text-bottom ml-0.5 bg-ink animate-pulse" />
                )}
              </p>
            </>
          )}
        </div>
      )}

      {status.kind === "done" && remainingArtifact !== undefined && (
        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">
          {remainingArtifact}{" "}
          {remainingArtifact === 1 ? "demo" : "demos"} left for this artifact
          today.
        </p>
      )}
    </div>
  );
}

function numHeader(v: string | null): number | undefined {
  if (v === null) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
