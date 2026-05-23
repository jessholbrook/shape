"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getHandle,
  setHandle as persistHandle,
  validateHandle,
  HANDLE_EVENT,
} from "@/lib/handle";

type Status =
  | { kind: "loading" }
  | { kind: "redirecting"; handle: string }
  | { kind: "needs-handle" };

export function ProfileGate() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "loading" });

  useEffect(() => {
    const existing = getHandle();
    if (existing) {
      setStatus({ kind: "redirecting", handle: existing });
      router.replace(`/p/${existing}`);
    } else {
      setStatus({ kind: "needs-handle" });
    }
    const refresh = () => {
      const h = getHandle();
      if (h) {
        setStatus({ kind: "redirecting", handle: h });
        router.replace(`/p/${h}`);
      }
    };
    window.addEventListener(HANDLE_EVENT, refresh);
    return () => window.removeEventListener(HANDLE_EVENT, refresh);
  }, [router]);

  if (status.kind === "loading") {
    return (
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Reading your browser…
      </p>
    );
  }

  if (status.kind === "redirecting") {
    return (
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
        Opening{" "}
        <Link
          href={`/p/${status.handle}`}
          className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
        >
          /p/{status.handle}
        </Link>
        …
      </p>
    );
  }

  return <ClaimHandle />;
}

function ClaimHandle() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit() {
    const v = validateHandle(raw);
    if (!v.ok) {
      setError(v.reason);
      return;
    }
    persistHandle(v.normalized);
    router.replace(`/p/${v.normalized}`);
  }

  return (
    <div className="flex flex-col gap-10 mt-8">
      <header>
        <h1 className="font-display text-[56px] md:text-[80px] leading-[0.98] tracking-tight text-ink">
          Your <span className="italic">profile</span>.
        </h1>
        <p className="mt-6 font-sans text-[17px] leading-[1.6] text-ink-muted max-w-2xl">
          Shape profiles live at{" "}
          <code className="font-mono text-[14px] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
            shape.app/p/&lt;handle&gt;
          </code>
          . Pick a handle to claim your URL — every artifact you publish will
          surface under it.
        </p>
      </header>

      <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8 flex flex-col gap-4">
        <label className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink">
            Pick a handle
          </span>
          <span className="font-mono text-[10px] text-ink-quiet">
            Lowercase letters, numbers, hyphens. 2–32 characters. You can
            change it later.
          </span>
          <input
            type="text"
            value={raw}
            onChange={(e) => {
              setRaw(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
            placeholder="your-handle"
            spellCheck={false}
            autoComplete="off"
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2.5 font-mono text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none mt-1"
          />
        </label>

        {error && (
          <p className="font-sans text-[13px] text-danger">{error}</p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <p className="font-mono text-[11px] text-ink-quiet">
            Preview:{" "}
            <code className="text-ink-muted">
              /p/{raw.trim().toLowerCase() || "your-handle"}
            </code>
          </p>
          <button
            type="button"
            onClick={submit}
            disabled={!raw.trim()}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
          >
            Claim handle
            <span className="text-highlight">→</span>
          </button>
        </div>
      </div>

      <div className="pt-8 border-t border-line">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Nothing published yet?
        </p>
        <p className="mt-3 font-sans text-[15px] leading-[1.6] text-ink-muted max-w-2xl">
          You can claim the handle now and publish later, or skip this and pick
          one the first time you hit Publish in the Notebook.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Link
            href="/play"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Open a playground →
          </Link>
          <Link
            href="/build"
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Browse studios
          </Link>
        </div>
      </div>
    </div>
  );
}
