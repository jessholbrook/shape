"use client";

import { useState } from "react";

type Kind = "feedback" | "bug" | "idea";

type Status =
  | { kind: "idle" }
  | { kind: "sending" }
  | { kind: "sent"; identifier: string | null; url: string | null }
  | { kind: "error"; message: string };

export function FeedbackButton() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [kind, setKind] = useState<Kind>("feedback");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  // Honeypot: hidden from people, tempting to bots. Left empty by real users.
  const [website, setWebsite] = useState("");

  function openModal() {
    setOpen(true);
    setStatus({ kind: "idle" });
  }

  function closeModal() {
    setOpen(false);
  }

  async function submit() {
    const body = text.trim();
    if (!body) return;
    setStatus({ kind: "sending" });

    let res: Response;
    try {
      res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          body,
          kind,
          website,
          url: window.location.href,
          userAgent: navigator.userAgent,
          viewport: `${window.innerWidth}×${window.innerHeight}`,
        }),
      });
    } catch (err) {
      const m = err instanceof Error ? err.message : String(err);
      setStatus({ kind: "error", message: m });
      return;
    }

    if (!res.ok) {
      let m = `Request failed (${res.status})`;
      try {
        const j = await res.json();
        if (j?.error?.message) m = j.error.message;
      } catch {
        /* ignore */
      }
      setStatus({ kind: "error", message: m });
      return;
    }

    const json = (await res.json()) as {
      identifier?: string | null;
      url?: string | null;
    };
    setStatus({
      kind: "sent",
      identifier: json.identifier ?? null,
      url: json.url ?? null,
    });
    setText("");
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        aria-label="Send feedback"
        className="fixed bottom-6 right-6 z-30 inline-flex items-center gap-2 bg-ink text-canvas rounded-full px-4 py-2 font-mono text-[11px] uppercase tracking-[0.08em] shadow-[0_4px_16px_rgba(0,0,0,0.18)] hover:bg-ink/90 transition-colors"
      >
        Feedback
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-ink/40 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-canvas border border-line rounded-[16px] max-w-[520px] w-full p-6 md:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.18)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
                Send feedback
              </p>
              <button
                type="button"
                onClick={closeModal}
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                Close
              </button>
            </div>
            <h2 className="font-display text-[28px] leading-[1.15] text-ink mt-2">
              What&apos;s on your mind?
            </h2>

            <div className="mt-5 flex flex-col gap-4">
              <fieldset className="flex flex-col gap-1.5">
                <legend className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  Kind
                </legend>
                <div className="flex gap-2 mt-1">
                  <KindChip value="feedback" current={kind} onSelect={setKind}>
                    General
                  </KindChip>
                  <KindChip value="bug" current={kind} onSelect={setKind}>
                    Bug
                  </KindChip>
                  <KindChip value="idea" current={kind} onSelect={setKind}>
                    Idea
                  </KindChip>
                </div>
              </fieldset>

              {/* Honeypot — off-screen and aria-hidden; only bots fill it. */}
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="absolute left-[-9999px] w-px h-px opacity-0"
              />

              <label className="flex flex-col gap-1.5">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet">
                  Tell us
                </span>
                <textarea
                  value={text}
                  onChange={(e) => {
                    setText(e.target.value);
                    if (status.kind === "error") setStatus({ kind: "idle" });
                  }}
                  rows={6}
                  maxLength={2000}
                  placeholder="What's working? What's broken? Anything you wish existed?"
                  className="w-full bg-surface border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] leading-[1.5] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none resize-y"
                />
              </label>
            </div>

            {status.kind === "error" && (
              <p className="mt-4 font-sans text-[13px] text-danger">
                {status.message}
              </p>
            )}
            {status.kind === "sent" && (
              <p className="mt-4 font-sans text-[13px] text-success">
                Thanks — filed{" "}
                {status.url && status.identifier ? (
                  <a
                    href={status.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-ink underline decoration-highlight underline-offset-4 decoration-2"
                  >
                    {status.identifier}
                  </a>
                ) : (
                  "in Linear"
                )}
                .
              </p>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <p className="font-mono text-[11px] text-ink-quiet max-w-[280px]">
                Your current URL, viewport, and user-agent travel with the
                message.
              </p>
              <button
                type="button"
                onClick={submit}
                disabled={status.kind === "sending" || !text.trim()}
                className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
              >
                {status.kind === "sending" ? "Sending…" : "Send"}
                <span className="text-highlight">→</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function KindChip({
  value,
  current,
  onSelect,
  children,
}: {
  value: Kind;
  current: Kind;
  onSelect: (k: Kind) => void;
  children: React.ReactNode;
}) {
  const active = value === current;
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={`font-mono text-[11px] uppercase tracking-[0.08em] rounded-full px-3 py-1 border transition-colors ${
        active
          ? "bg-ink text-canvas border-ink"
          : "border-line text-ink-muted hover:border-ink-muted hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
