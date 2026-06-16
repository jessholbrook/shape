import { getModel, type ProviderId } from "@/lib/providers";

/**
 * Shared educational copy for the Provider / Model / Temperature controls,
 * used by both ProviderModelTempRow (most playgrounds) and ConfigPanel (Diff
 * Mode) so the in-experience help reads the same everywhere.
 */

export function temperatureRegime(t: number): string {
  if (t <= 0.2) return "Deterministic";
  if (t < 0.8) return "Creative";
  return "Loose";
}

export const ProviderTip = (
  <>
    <span className="block">
      <strong>Free (in browser):</strong> runs a small open model on your own
      device — private, no key, no per-token cost. Lower quality, with a
      one-time download (~280MB–2GB) on first use.
    </span>
    <span className="block mt-2">
      <strong>Anthropic / OpenAI:</strong> sharper and faster, but need a key
      and bill you per token.
    </span>
    <span className="block mt-2 text-canvas/75">
      Trade-off: quality vs. cost &amp; privacy.
    </span>
  </>
);

export function ModelTip({
  provider,
  model,
}: {
  provider: ProviderId;
  model: string;
}) {
  const selected = getModel(provider, model);
  if (provider === "webllm") {
    return (
      <>
        <span className="block">
          Each model is downloaded once and cached. Bigger = better quality but
          a slower first run.
        </span>
        <span className="block mt-2 text-canvas/75">
          Selected: <strong>{selected?.name ?? model}</strong>
          {selected?.blurb && <> — {selected.blurb}</>}.
        </span>
      </>
    );
  }
  return (
    <>
      <span className="block">
        <strong>Frontier</strong> — top quality, slow, pricier.
      </span>
      <span className="block mt-1.5">
        <strong>Balanced</strong> — good quality, fast, recommended for most
        playgrounds.
      </span>
      <span className="block mt-1.5">
        <strong>Fast</strong> — cheap and quick.
      </span>
      <span className="block mt-2 text-canvas/75">
        Selected: <em>{selected?.name ?? model}</em>.
      </span>
    </>
  );
}

export const TemperatureTip = (
  <>
    <span className="block">
      Temperature controls how random the model&apos;s word choices are — the
      same prompt can give a different answer each run. Low keeps it focused
      and repeatable; high makes it varied and surprising.
    </span>
    <span className="block mt-2">
      <strong>0</strong> — identical every time, good for tests and rubrics.
    </span>
    <span className="block mt-1.5">
      <strong>0.7</strong> — creative but coherent, a good default.
    </span>
    <span className="block mt-1.5">
      <strong>1.0</strong> — loose and sometimes incoherent.
    </span>
  </>
);
