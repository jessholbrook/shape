"use client";

import { useState } from "react";
import { Provider, PROVIDER_LIST, ProviderId } from "@/lib/providers";
import { useKeys } from "@/lib/hooks/use-keys";
import { maskKey, validateKey } from "@/lib/keys";
import { testConnection } from "@/lib/providers/index";

type TestState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "ok" }
  | { status: "error"; reason: string };

export function KeySetupForm() {
  const { keys, hydrated, saveKey, clearKey } = useKeys();

  return (
    <div className="space-y-6">
      {PROVIDER_LIST.map((p) => (
        <ProviderRow
          key={p.id}
          provider={p}
          existing={keys[p.id]}
          hydrated={hydrated}
          onSave={(v) => saveKey(p.id, v)}
          onClear={() => clearKey(p.id)}
        />
      ))}
    </div>
  );
}

function ProviderRow({
  provider,
  existing,
  hydrated,
  onSave,
  onClear,
}: {
  provider: Provider;
  existing: string | undefined;
  hydrated: boolean;
  onSave: (key: string) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stored = !!existing;

  function handleSave() {
    const result = validateKey(provider.id, value);
    if (!result.ok) {
      setError(result.reason ?? "Invalid key.");
      return;
    }
    setError(null);
    onSave(value);
    setValue("");
    setEditing(false);
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h3 className="font-display text-[26px] leading-[1.15] text-ink">
            {provider.name}
          </h3>
          <p className="font-sans text-[14px] text-ink-muted mt-1">
            {stored ? (
              <>Key saved — {hydrated ? maskKey(existing!) : "•••"}</>
            ) : (
              <>
                Get a key from{" "}
                <a
                  href={provider.consoleUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
                >
                  {provider.name} console
                </a>
                .
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em]">
          <ProviderStatus stored={stored} hydrated={hydrated} />
        </div>
      </div>

      {(editing || !stored) && (
        <div className="mt-6">
          <label className="block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
            API key
          </label>
          <input
            type="password"
            spellCheck={false}
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError(null);
            }}
            placeholder={`${provider.keyPrefix}...`}
            className="w-full bg-canvas border border-line rounded-[12px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
          />
          {error && (
            <p className="mt-2 font-sans text-[13px] text-danger">{error}</p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!value}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {stored ? "Replace key" : "Save key"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setValue("");
                  setError(null);
                }}
                className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {stored && !editing && (
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <TestButton providerId={provider.id} apiKey={existing!} />
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
          >
            Replace
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`Remove your ${provider.name} key from this browser?`)) {
                onClear();
              }
            }}
            className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-danger"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function TestButton({
  providerId,
  apiKey,
}: {
  providerId: ProviderId;
  apiKey: string;
}) {
  const [state, setState] = useState<TestState>({ status: "idle" });

  async function run() {
    setState({ status: "running" });
    const result = await testConnection(providerId, apiKey);
    if (result.ok) setState({ status: "ok" });
    else setState({ status: "error", reason: result.reason });
  }

  return (
    <div className="inline-flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={state.status === "running"}
        className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink disabled:opacity-60"
      >
        {state.status === "running" ? "Testing…" : "Test"}
      </button>
      {state.status === "ok" && (
        <span className="font-mono text-[11px] uppercase tracking-[0.08em] text-success">
          ● Reached the API
        </span>
      )}
      {state.status === "error" && (
        <span
          className="font-mono text-[11px] uppercase tracking-[0.08em] text-danger"
          title={state.reason}
        >
          ● Failed — {state.reason.slice(0, 60)}
        </span>
      )}
    </div>
  );
}

function ProviderStatus({
  stored,
  hydrated,
}: {
  stored: boolean;
  hydrated: boolean;
}) {
  if (!hydrated) {
    return <span className="text-ink-quiet">Checking…</span>;
  }
  if (stored) {
    return (
      <span className="inline-flex items-center gap-1.5 text-success">
        <span className="w-1.5 h-1.5 rounded-full bg-success" /> Connected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-ink-quiet">
      <span className="w-1.5 h-1.5 rounded-full bg-ink-quiet" /> Not connected
    </span>
  );
}
