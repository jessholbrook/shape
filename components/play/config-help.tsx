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
    <strong>Free (in browser)</strong> runs small open models via WebGPU — no
    key, no server. <strong>Anthropic</strong> + <strong>OpenAI</strong> need a
    key but unlock bigger models. The first in-browser run downloads the model
    once (~280MB to 2GB depending on choice).
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
        Each model is downloaded once and cached. Bigger = better quality but a
        slower first run. <strong>{selected?.name ?? model}</strong>
        {selected?.blurb && <> — {selected.blurb}</>}.
      </>
    );
  }
  return (
    <>
      <strong>Frontier</strong> = top quality, slow, pricier.{" "}
      <strong>Balanced</strong> = good quality, fast, recommended for most
      playgrounds. <strong>Fast</strong> = cheap and quick. Selected:{" "}
      <em>{selected?.name ?? model}</em>.
    </>
  );
}

export const TemperatureTip = (
  <>
    Temperature controls how random the model&apos;s word choices are — the same
    prompt can give a different answer each run. Low keeps it focused and
    repeatable; high makes it varied and surprising. <strong>0</strong> =
    identical every time, good for tests and rubrics. <strong>0.7</strong> =
    creative but coherent, a good default. <strong>1.0</strong> = loose and
    sometimes incoherent.
  </>
);
