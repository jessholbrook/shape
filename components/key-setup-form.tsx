"use client";

import { useState } from "react";
import { Provider, BYOK_PROVIDERS, ProviderId } from "@/lib/providers";
import { useKeys } from "@/lib/hooks/use-keys";
import { useLiveModels } from "@/lib/hooks/use-live-models";
import { useCustomEndpoint } from "@/lib/hooks/use-custom-endpoint";
import { maskKey, validateKey } from "@/lib/keys";
import { endpointLabel, validateBaseUrl } from "@/lib/custom-endpoint";
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
      {BYOK_PROVIDERS.map((p) =>
        p.id === "custom" ? (
          <CustomEndpointRow
            key={p.id}
            provider={p}
            existing={keys.custom}
            hydrated={hydrated}
            onSave={(v) => saveKey("custom", v)}
            onClear={() => clearKey("custom")}
          />
        ) : (
          <ProviderRow
            key={p.id}
            provider={p}
            existing={keys[p.id]}
            hydrated={hydrated}
            onSave={(v) => saveKey(p.id, v)}
            onClear={() => clearKey(p.id)}
          />
        ),
      )}
    </div>
  );
}

/**
 * What the provider's API says exists, once a key is saved. The static
 * catalog supplies names and pricing; this line says whether the picker is
 * running on the live list or the built-in one.
 */
function LiveModelsNote({ providerId }: { providerId: ProviderId }) {
  const { models, status, error, refresh } = useLiveModels(providerId);
  if (status === "static") return null;
  return (
    <p className="mt-3 font-mono text-[11px] text-ink-quiet flex flex-wrap items-center gap-x-2">
      {status === "loading" && "Listing models from the API…"}
      {status === "live" && (
        <>
          <span className="text-success">●</span> {models.length} model
          {models.length === 1 ? "" : "s"} listed by the API
          {models.some((m) => m.pricingUnknown) && (
            <span>
              · {models.filter((m) => m.pricingUnknown).length} without a rate card
            </span>
          )}
        </>
      )}
      {status === "error" && (
        <span className="text-highlight-ink">
          Couldn&apos;t list models: {error}. The picker shows the built-in list.
        </span>
      )}
      {status !== "loading" && (
        <button
          type="button"
          onClick={refresh}
          className="underline decoration-line underline-offset-2 hover:text-ink"
        >
          {status === "error" ? "retry" : "refresh"}
        </button>
      )}
    </p>
  );
}

/**
 * Any OpenAI-compatible base URL. Called straight from the browser — there
 * is deliberately no proxy for this one, since a relay to a user-supplied URL
 * is an open relay — so the endpoint has to allow browser requests.
 * OpenRouter and local servers do. Local servers ignore the key.
 */
function CustomEndpointRow({
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
  const { endpoint, save: saveEndpoint, clear: clearEndpoint } = useCustomEndpoint();
  const [baseUrl, setBaseUrl] = useState("");
  const [value, setValue] = useState("");
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The checkbox follows what is saved until the user touches it.
  const [keylessDraft, setKeylessDraft] = useState<boolean | null>(null);
  const keyless = keylessDraft ?? !!endpoint?.keyless;

  // Set up means a URL plus either a key or the decision not to need one.
  const stored = !!endpoint && (endpoint.keyless === true || !!existing);

  function handleSave() {
    const url = baseUrl.trim() || endpoint?.baseUrl || "";
    const urlCheck = validateBaseUrl(url);
    if (!urlCheck.ok) {
      setError(urlCheck.reason);
      return;
    }
    if (keyless) {
      // A local server: no key stored, no Authorization header sent.
      setError(null);
      saveEndpoint(url, true);
      if (existing) onClear();
    } else {
      const key = value.trim() || existing || "";
      if (!key) {
        setError("Add a key — or tick the box if this is a local server that wants none.");
        return;
      }
      setError(null);
      saveEndpoint(url, false);
      onSave(key);
    }
    setBaseUrl("");
    setValue("");
    setKeylessDraft(null);
    setEditing(false);
  }

  return (
    <div className="bg-surface border border-line rounded-[16px] p-6 md:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h3 className="font-display text-[26px] leading-[1.15] text-ink">
            {provider.name}
          </h3>
          <p className="font-sans text-[14px] text-ink-muted mt-1 max-w-lg">
            {stored ? (
              endpoint!.keyless ? (
                <>
                  {endpointLabel(endpoint!.baseUrl)} — no key, called directly from
                  your browser
                </>
              ) : (
                <>
                  {endpointLabel(endpoint!.baseUrl)} — key saved,{" "}
                  {hydrated && existing ? maskKey(existing) : "•••"}
                </>
              )
            ) : (
              <>
                Any OpenAI-compatible base URL:{" "}
                <a
                  href={provider.signupUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
                >
                  OpenRouter
                </a>
                , Groq, Together, or a local LM Studio or Ollama. Called from
                your browser, never through Shape&apos;s servers — the
                endpoint has to allow browser requests. A local server that
                wants no key can say so below.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em]">
          <ProviderStatus stored={stored} hydrated={hydrated} />
        </div>
      </div>

      {(editing || !stored) && (
        <div className="mt-6 flex flex-col gap-4">
          <div>
            <label className="block font-mono text-[11px] uppercase tracking-[0.08em] text-ink-quiet mb-2">
              Base URL
            </label>
            <input
              type="url"
              spellCheck={false}
              autoComplete="off"
              value={baseUrl}
              onChange={(e) => {
                setBaseUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder={endpoint?.baseUrl ?? "https://openrouter.ai/api/v1"}
              aria-label="Custom endpoint base URL"
              className="w-full bg-canvas border border-line rounded-[12px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
            />
          </div>
          <label className="flex items-start gap-3 font-sans text-[14px] text-ink">
            <input
              type="checkbox"
              checked={keyless}
              onChange={(e) => {
                setKeylessDraft(e.target.checked);
                if (error) setError(null);
              }}
              className="mt-1 accent-ink"
            />
            <span>
              No key — this is a local server (LM Studio, Ollama)
              <span className="block font-mono text-[11px] text-ink-quiet mt-0.5">
                Calls go out with no Authorization header, and the playgrounds
                stop asking for one.
              </span>
            </span>
          </label>
          {!keyless && (
            <div>
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
                placeholder={existing ? "(unchanged)" : "sk-or-…"}
                aria-label="Custom endpoint API key"
                className="w-full bg-canvas border border-line rounded-[12px] px-4 py-3 font-mono text-[14px] text-ink placeholder:text-ink-quiet focus:border-ink focus:outline-none"
              />
            </div>
          )}
          {error && (
            <p className="font-sans text-[13px] text-danger">{error}</p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!baseUrl && !endpoint}
              className="inline-flex items-center gap-2 bg-ink text-canvas rounded-[10px] px-4 py-2 font-sans text-[14px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-ink/90 transition-colors"
            >
              {stored ? "Update endpoint" : "Save endpoint"}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setBaseUrl("");
                  setValue("");
                  setKeylessDraft(null);
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
        <>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <TestButton providerId="custom" apiKey={existing ?? ""} />
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              Change
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm("Remove the custom endpoint and its key from this browser?")) {
                  onClear();
                  clearEndpoint();
                }
              }}
              className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink-muted hover:text-danger"
            >
              Remove
            </button>
          </div>
          <LiveModelsNote providerId="custom" />
        </>
      )}
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
            placeholder={`${provider.keyPrefixes[0] ?? ""}...`}
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

      {stored && !editing && <LiveModelsNote providerId={provider.id} />}

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
