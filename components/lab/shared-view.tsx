"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { analyze, manifestHash, type Condition, type Experiment, type Measure } from "@/lib/experiment";
import { assertionLabel } from "@/lib/spread";
import { saveDraft } from "@/lib/drafts";
import { forkExperiment, type SharedExperiment } from "@/lib/sharing";
import { PROVIDERS } from "@/lib/providers";
import { Findings, ResultsTable, RunList } from "./results";
import { EYEBROW, LINK_BUTTON, PANEL, PanelHeader } from "./fields";

/**
 * A shared experiment, read-only: what was asked, how it was set up, what
 * came back, and the record to check it against. The one action that matters
 * is rerunning it — a result someone else can reproduce is worth more than
 * one they have to take on trust.
 */
export function SharedView({ shared }: { shared: SharedExperiment }) {
  const e = shared.experiment;
  const analysis = useMemo(() => analyze(e), [e]);
  const hasResults = e.runs.some((r) => r.status === "done");

  return (
    <div className="flex flex-col gap-6">
      <RerunBar shared={shared} />

      <section className={PANEL} aria-label="Question and hypothesis">
        <PanelHeader num="01" title="The question" />
        <p className="font-sans text-[17px] leading-[1.55] text-ink">{e.question}</p>
        {e.hypothesis.trim() && (
          <div>
            <p className={EYEBROW}>Hypothesis{e.hypothesisLockedAt ? " — written before the first run" : ""}</p>
            <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-1">{e.hypothesis}</p>
          </div>
        )}
      </section>

      <Design experiment={e} />

      {hasResults ? (
        <>
          <Findings experiment={e} analysis={analysis} />
          <ResultsTable experiment={e} analysis={analysis} />
          <RunList experiment={e} />
        </>
      ) : (
        <p className="bg-surface border border-line rounded-[12px] px-4 py-3 font-sans text-[14px] text-ink-muted" data-testid="shared-design-only">
          This was shared as a design, with no results. Run it yourself to see what happens.
        </p>
      )}

      <ManifestCheck shared={shared} />
      <Report slug={shared.slug} />
    </div>
  );
}

function RerunBar({ shared }: { shared: SharedExperiment }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  function rerun() {
    setBusy(true);
    const forked = forkExperiment(shared, Date.now());
    const draft = saveDraft({ kind: "experiment", title: forked.title, experiment: forked });
    router.push(`/lab?draft=${draft.id}`);
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 bg-surface border border-line rounded-[16px] p-5">
      <p className="font-sans text-[14px] leading-[1.5] text-ink-muted max-w-xl">
        Shared {new Date(shared.createdAt).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}. Read-only —
        rerun it to get your own results under the same setup.
      </p>
      <button
        type="button"
        onClick={rerun}
        disabled={busy}
        className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 hover:bg-ink/90 transition-colors"
      >
        Run it yourself <span className="text-highlight">→</span>
      </button>
    </div>
  );
}

// --- Design ----------------------------------------------------------------------

const modelName = (m: { provider: string; model: string }) => {
  const p = PROVIDERS[m.provider as keyof typeof PROVIDERS];
  return `${p?.models.find((x) => x.id === m.model)?.name ?? m.model}${p ? ` · ${p.name}` : ""}`;
};

function changes(c: Condition): string[] {
  const out: string[] = [];
  if (c.patch.system !== undefined) out.push(`System prompt: ${c.patch.system}`);
  if (c.patch.userTemplate !== undefined) out.push(`User message: ${c.patch.userTemplate}`);
  if (c.patch.temperature !== undefined) out.push(`Temperature: ${c.patch.temperature}`);
  if (c.patch.model) out.push(`Model: ${modelName(c.patch.model)}`);
  return out;
}

function measureDetail(m: Measure): string {
  switch (m.kind) {
    case "assertion":
      return assertionLabel(m.assertion);
    case "regex":
      return m.describe ?? `Matches /${m.pattern}/${m.flags ?? ""}`;
    case "length":
      return "Words in the answer";
    case "classify":
      return `A judge (${modelName(m.judge)}) answers “${m.question}” — counted when it says “${m.target}”`;
    case "rate":
      return `A judge (${modelName(m.judge)}) rates 1–${m.scale}: ${m.rubric}`;
  }
}

function Design({ experiment: e }: { experiment: Experiment }) {
  return (
    <section className={PANEL} aria-label="Design">
      <PanelHeader num="02" title="How it was set up" hint={`Each version was run ${e.n} times${e.items.length ? " per item" : ""}.`} />
      <dl className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-x-4 gap-y-3">
        <dt className={EYEBROW}>Model</dt>
        <dd className="font-sans text-[14px] text-ink">
          {modelName(e.base.model)} · temperature {e.base.temperature} · up to {e.base.maxTokens} tokens
        </dd>
        <dt className={EYEBROW}>System prompt</dt>
        <dd className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap">{e.base.system || "—"}</dd>
        <dt className={EYEBROW}>User message</dt>
        <dd className="font-mono text-[12px] leading-[1.6] text-ink whitespace-pre-wrap">{e.base.userTemplate}</dd>
      </dl>

      <div className="border-t border-line pt-4">
        <p className={`${EYEBROW} mb-2`}>Conditions</p>
        <ol className="flex flex-col gap-2.5">
          {e.conditions.map((c, i) => (
            <li key={c.id}>
              <p className="font-sans text-[14px] text-ink">
                {c.label}
                {i === 0 && <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-quiet">baseline</span>}
              </p>
              {changes(c).map((line) => (
                <p key={line} className="font-mono text-[12px] leading-[1.6] text-ink-muted whitespace-pre-wrap">
                  {line}
                </p>
              ))}
              {i > 0 && changes(c).length === 0 && <p className="font-sans text-[12px] text-ink-quiet">Same as the baseline.</p>}
            </li>
          ))}
        </ol>
      </div>

      {e.items.length > 0 && (
        <div className="border-t border-line pt-4">
          <p className={`${EYEBROW} mb-2`}>Items</p>
          <ul className="flex flex-col gap-1.5">
            {e.items.map((it) => (
              <li key={it.id} className="font-sans text-[13px] text-ink">
                {it.label}
                <span className="text-ink-muted">
                  {" — "}
                  {Object.entries(it.vars)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="border-t border-line pt-4">
        <p className={`${EYEBROW} mb-2`}>Measures</p>
        <ul className="flex flex-col gap-1.5">
          {e.measures.map((m) => (
            <li key={m.id} className="font-sans text-[13px] text-ink">
              {m.label}
              <span className="text-ink-muted"> — {measureDetail(m)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Manifest --------------------------------------------------------------------

function ManifestCheck({ shared }: { shared: SharedExperiment }) {
  const [verified, setVerified] = useState<boolean | null>(null);
  useEffect(() => {
    let live = true;
    manifestHash(shared.manifest).then((h) => live && setVerified(h === shared.manifestHash));
    return () => {
      live = false;
    };
  }, [shared]);

  function download() {
    const blob = new Blob([JSON.stringify({ manifest: shared.manifest, manifestHash: shared.manifestHash, experiment: shared.experiment }, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shape-experiment-${shared.slug}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const m = shared.manifest;
  return (
    <section className={PANEL} aria-label="Manifest">
      <PanelHeader
        num="Manifest"
        title="The record"
        hint="Every prompt, model and setting that was run, and the statistics used. The fingerprint changes if any of it does."
        action={
          <button type="button" onClick={download} className={LINK_BUTTON}>
            Download JSON
          </button>
        }
      />
      <dl className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-x-4 gap-y-2 font-sans text-[13px]">
        <dt className={EYEBROW}>Fingerprint</dt>
        <dd className="font-mono text-[12px] text-ink break-all" data-testid="shared-hash">
          {shared.manifestHash}
          <span className={`block font-sans text-[12px] mt-0.5 ${verified === false ? "text-danger" : "text-ink-quiet"}`}>
            {verified === null ? "Checking…" : verified ? "Matches the record below." : "Doesn't match the record — treat these results with caution."}
          </span>
        </dd>
        <dt className={EYEBROW}>Ran</dt>
        <dd className="text-ink">
          {new Date(m.ranAt).toLocaleString()} · {m.runner === "hosted" ? "Shape's free tier" : m.runner === "byok" ? "the publisher's own key" : m.runner === "webllm" ? "an in-browser model" : "a custom endpoint"}
        </dd>
        <dt className={EYEBROW}>Models</dt>
        <dd className="text-ink">
          {m.models.requested.join(", ")}
          {m.models.judges.length > 0 && <span className="text-ink-muted"> · judged by {m.models.judges.join(", ")}</span>}
        </dd>
      </dl>
      <p className="font-sans text-[12px] leading-[1.5] text-ink-quiet">{m.notes.join(" ")}</p>
    </section>
  );
}

// --- Report ----------------------------------------------------------------------

function Report({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  async function send() {
    setState("sending");
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind: "bug", body: `[Shared experiment report] /e/${slug}\n\n${reason.trim()}`, url: window.location.href }),
    }).catch(() => null);
    setState(res?.ok ? "sent" : "error");
  }

  if (state === "sent") return <p className="font-sans text-[13px] text-ink-muted">Thanks — the report went to Shape&apos;s maintainer.</p>;
  return (
    <div className="flex flex-col gap-2">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className={`${LINK_BUTTON} self-start`}>
          Report this page
        </button>
      ) : (
        <>
          <label htmlFor="report-reason" className={EYEBROW}>
            What&apos;s wrong with it?
          </label>
          <textarea
            id="report-reason"
            rows={2}
            maxLength={1500}
            value={reason}
            onChange={(ev) => setReason(ev.target.value)}
            className="w-full bg-canvas border border-line rounded-[10px] px-3 py-2 font-sans text-[14px] text-ink focus:border-ink focus:outline-none"
          />
          <div className="flex items-center gap-4">
            <button type="button" onClick={send} disabled={!reason.trim() || state === "sending"} className={LINK_BUTTON}>
              {state === "sending" ? "Sending…" : "Send report"}
            </button>
            {state === "error" && <span className="font-sans text-[12px] text-danger">Couldn&apos;t send it. Try again later.</span>}
          </div>
        </>
      )}
    </div>
  );
}
