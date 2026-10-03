"use client";

import { useState } from "react";
import Link from "next/link";
import { BYOK_PROVIDERS, PROVIDERS, type ProviderId } from "@/lib/providers";
import { useKeys } from "@/lib/hooks/use-keys";
import { validateKey } from "@/lib/keys";
import { testConnection } from "@/lib/providers/index";
import { KeyPrivacyNote } from "@/components/key-privacy-note";
import { LocalModelStorage } from "@/components/local-model-storage";
import { WebLLMDisclosure } from "@/components/webllm-disclosure";
import { useHostedStatus } from "@/lib/hooks/use-hosted-status";
import { setRunPreference, type RunPreference } from "@/lib/run-preference";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok" }
  | { status: "error"; reason: string };

export function StartFlow() {
  const { keys, hydrated, hasAnyKey, saveKey } = useKeys();

  if (!hydrated) {
    return (
      <div className="bg-surface border border-line rounded-[16px] p-8 min-h-[240px] hatched">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Checking your browser for keys…
        </p>
      </div>
    );
  }

  if (hasAnyKey) {
    return <SuccessState keys={keys} />;
  }

  return <KeyEntry onSaved={saveKey} />;
}

function KeyEntry({
  onSaved,
}: {
  onSaved: (providerId: ProviderId, key: string) => void;
}) {
  const [picked, setPicked] = useState<ProviderId>("anthropic");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<TestState>({ status: "idle" });
  const [saved, setSaved] = useState(false);

  const provider = PROVIDERS[picked];

  function pick(id: ProviderId) {
    setPicked(id);
    setValue("");
    setError(null);
    setTest({ status: "idle" });
  }

  async function handleSaveAndTest() {
    const v = validateKey(picked, value);
    if (!v.ok) {
      setError(v.reason ?? "Invalid key.");
      return;
    }
    setError(null);
    setTest({ status: "running" });
    const result = await testConnection(picked, value.trim());
    if (result.ok) {
      onSaved(picked, value.trim());
      setTest({ status: "ok" });
      setSaved(true);
    } else {
      setTest({ status: "error", reason: result.reason });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <FreeOptions />

      <div className="flex items-center gap-4">
        <div className="flex-1 border-t border-line" />
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Or use your own key
        </span>
        <div className="flex-1 border-t border-line" />
      </div>

      <KeyPrivacyNote />

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-4">
          Step 1 — Pick a provider
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {BYOK_PROVIDERS.map((p) => (
            <ProviderCard
              key={p.id}
              providerId={p.id}
              name={p.name}
              consoleUrl={p.consoleUrl}
              picked={picked === p.id}
              onPick={() => pick(p.id)}
              recommendation={
                p.id === "anthropic" ? "Recommended for first-timers" : null
              }
            />
          ))}
        </div>
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-4">
          Step 2 — Paste your {provider.name} key
        </p>
        <div className="bg-surface border border-line rounded-[16px] p-6">
          <p className="font-sans text-[14px] text-ink-muted mb-4">
            Don&apos;t have one?{" "}
            <a
              href={provider.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Get a key from the {provider.name} console
            </a>{" "}
            — takes about two minutes.
          </p>
          <input
            type="password"
            spellCheck={false}
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
              if (test.status !== "idle") setTest({ status: "idle" });
            }}
            placeholder={`${provider.keyPrefixes[0] ?? ""}...`}
            className="w-full bg-canvas border border-line rounded-[12px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
          />
          {error && (
            <p className="mt-2 font-sans text-[13px] text-danger">{error}</p>
          )}
          <p className="mt-2 font-mono text-[11px] text-ink-quiet">
            Saved to this browser only — never sent to a Shape server.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={handleSaveAndTest}
              disabled={!value || test.status === "running" || saved}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {test.status === "running"
                ? "Testing…"
                : saved
                ? "Connected"
                : "Save & test"}
              <span className="text-highlight">→</span>
            </button>
            {test.status === "ok" && (
              <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                Reached the API
              </span>
            )}
            {test.status === "error" && (
              <span
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-danger inline-flex items-center gap-1.5"
                title={test.reason}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-danger" />
                Failed — {test.reason.slice(0, 80)}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="border-t border-line pt-6 flex justify-end">
        <Link
          href="/settings/keys"
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
        >
          Manage all keys →
        </Link>
      </div>
    </div>
  );
}

function ProviderCard({
  providerId,
  name,
  consoleUrl,
  picked,
  onPick,
  recommendation,
}: {
  providerId: ProviderId;
  name: string;
  consoleUrl: string;
  picked: boolean;
  onPick: () => void;
  recommendation: string | null;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={`text-left bg-surface border rounded-[16px] p-5 transition-colors ${
        picked
          ? "border-ink shadow-[0_4px_16px_rgba(0,0,0,0.06)]"
          : "border-line hover:border-ink-muted"
      }`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-[22px] leading-[1.15] text-ink">
          {name}
        </h3>
        <span
          className={`w-3 h-3 rounded-full border-2 ${
            picked ? "border-ink bg-highlight" : "border-line bg-transparent"
          }`}
          aria-hidden
        />
      </div>
      {recommendation && (
        <p className="mt-3 inline-flex items-center font-mono text-[10px] uppercase tracking-[0.08em] bg-highlight-soft text-highlight-ink rounded-full px-2 py-0.5">
          {recommendation}
        </p>
      )}
      <p className="mt-3 font-sans text-[13px] leading-[1.5] text-ink-muted">
        Get a key from the{" "}
        <span className="text-ink-muted">{name} console</span> at{" "}
        <span className="font-mono text-[12px] text-ink">
          {new URL(consoleUrl).host}
        </span>
        .
      </p>
      <span className="sr-only">Pick {providerId}</span>
    </button>
  );
}

function SuccessState({ keys }: { keys: Partial<Record<ProviderId, string>> }) {
  const connectedProviders = BYOK_PROVIDERS.filter((p) => keys[p.id]);
  const connectedNames = connectedProviders.map((p) => p.name).join(" and ");
  const missing = BYOK_PROVIDERS.filter((p) => !keys[p.id]);

  return (
    <div className="flex flex-col gap-8">
      <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-success">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          Connected via {connectedNames}
        </div>
        <h2 className="font-display text-[34px] md:text-[40px] leading-[1.05] tracking-tight text-ink mt-4">
          You&apos;re ready to shape.
        </h2>
        <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-4 max-w-lg">
          Every playground is unlocked. Most people start with Diff Mode for
          the fastest sense of how prompts shape outputs. Tone Dial is good
          if you want to feel style as a lever.
        </p>
      </div>

      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-4">
          Pick where to start
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <NextStepCard
            href="/play/diff"
            kicker="Diff Mode"
            title="One prompt, two configs"
            blurb="Side-by-side outputs. The fastest way to feel how prompts shape behavior."
          />
          <NextStepCard
            href="/play/tone"
            kicker="Tone Dial"
            title="Style as a design token"
            blurb="Move dials for warmth, verbosity, directness. Watch the prompt rewrite itself."
          />
        </div>
        <div className="mt-3 flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/play"
              className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              See all playgrounds →
            </Link>
          </div>
          <Link
            href="/settings/keys"
            className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
          >
            Manage keys
          </Link>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="border-t border-line pt-6">
          <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
            Optional — add{" "}
            <span className="text-ink-muted">
              {missing.map((p) => p.name).join(" / ")}
            </span>{" "}
            too to compare providers in Diff Mode.{" "}
            <Link
              href="/settings/keys"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Add another →
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}

function NextStepCard({
  href,
  kicker,
  title,
  blurb,
}: {
  href: string;
  kicker: string;
  title: string;
  blurb: string;
}) {
  return (
    <Link
      href={href}
      className="group block bg-surface border border-line rounded-[16px] p-5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.06)] transition-shadow"
    >
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          {kicker}
        </span>
        <span className="font-mono text-[12px] text-ink group-hover:text-highlight transition-colors">
          Open →
        </span>
      </div>
      <h3 className="font-display text-[22px] leading-[1.15] text-ink mt-3">
        {title}
      </h3>
      <p className="font-sans text-[14px] leading-[1.5] text-ink-muted mt-2">
        {blurb}
      </p>
    </Link>
  );
}

/**
 * The free ways to run. Hosted Claude shows only when the free tier is up (or
 * up but used up today, so a returning reader learns why it's gone); the
 * in-browser model is always offered. Each card says where prompts go — the
 * one fact a reader can't see from the outside.
 */
function FreeOptions() {
  const hosted = useHostedStatus();

  if (!hosted.resolved) {
    return (
      <div className="bg-surface border border-line rounded-[16px] p-8 min-h-[240px] hatched">
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">
          Checking the free options…
        </p>
      </div>
    );
  }

  const showHosted = hosted.limit > 0;
  const usedUp = showHosted && hosted.remaining <= 0;

  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-4">
        {showHosted ? "Two free ways to run — pick one, switch any time" : "Free — no key needed"}
      </p>
      <div className={`grid grid-cols-1 gap-4 items-start ${showHosted ? "md:grid-cols-2" : ""}`}>
        {showHosted && (
          <RunCard
            testId="run-hosted"
            badge={usedUp ? null : "Recommended"}
            title="Free Claude, hosted by Shape"
            blurb="Claude Haiku 4.5 on Shape's account. Nothing to download or set up — open a playground and go."
            facts={[
              ["Model", "Claude Haiku 4.5 — small, fast, capable"],
              ["Your prompts", "Sent to Anthropic through Shape's server to be answered. Shape doesn't store them."],
              [
                "Limits",
                usedUp
                  ? "You've used today's free runs. More at midnight UTC."
                  : `${hosted.remaining} of ${hosted.limit} free runs left today. Resets at midnight UTC.`,
              ],
            ]}
            cta="Open Diff Mode with free Claude"
            pref="hosted"
            disabled={usedUp}
          />
        )}
        <RunCard
          testId="run-local"
          badge={showHosted ? null : "Recommended"}
          title="Private, in your browser"
          blurb="A small open model runs on your own device via WebGPU. The first run downloads it once (about 1GB); after that it's instant."
          facts={[
            ["Model", "A small open model — rougher answers than Claude"],
            ["Your prompts", "Never leave your machine."],
            ["Limits", "None. Needs a recent desktop browser with WebGPU."],
          ]}
          cta="Open Diff Mode in your browser"
          pref="local"
        >
          <div className="mt-5 pt-4 border-t border-line">
            <WebLLMDisclosure />
          </div>
          <div className="mt-3">
            <LocalModelStorage />
          </div>
        </RunCard>
      </div>
      <p className="mt-3 font-sans text-[13px] leading-[1.5] text-ink-muted">
        Every playground has a model picker, so you can change your mind later.{" "}
        <Link href="/play" className="text-ink underline decoration-highlight underline-offset-4 decoration-2">
          All playgrounds →
        </Link>
      </p>
    </div>
  );
}

function RunCard({
  testId,
  badge,
  title,
  blurb,
  facts,
  cta,
  pref,
  disabled,
  children,
}: {
  testId: string;
  badge: string | null;
  title: string;
  blurb: string;
  facts: [string, string][];
  cta: string;
  pref: RunPreference;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div data-testid={testId} className="bg-surface border border-line rounded-[16px] p-6 md:p-7 flex flex-col">
      {badge ? (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-success inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success" />
          {badge} · Free
        </p>
      ) : (
        <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet">Free</p>
      )}
      <h2 className="font-display text-[26px] md:text-[30px] leading-[1.1] text-ink mt-3">{title}</h2>
      <p className="font-sans text-[15px] leading-[1.55] text-ink-muted mt-3">{blurb}</p>
      <dl className="mt-5 flex flex-col gap-2.5">
        {facts.map(([k, v]) => (
          <div key={k} className="grid grid-cols-[96px_1fr] gap-3">
            <dt className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-quiet pt-[3px]">{k}</dt>
            <dd className="font-sans text-[13px] leading-[1.5] text-ink">{v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6">
        {disabled ? (
          <span className="inline-flex items-center gap-2 bg-ink/40 text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] cursor-not-allowed">
            {cta}
          </span>
        ) : (
          <Link
            href="/play/diff"
            onClick={() => setRunPreference(pref)}
            className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-5 py-2.5 font-sans text-[14px] hover:bg-ink/90 transition-colors"
          >
            {cta}
            <span className="text-highlight">→</span>
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
