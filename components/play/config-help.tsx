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
    <strong>Free (in browser)</strong> runs a small open model on your own
    device — private, no key, no per-token cost — but lower quality, and a
    one-time download (~280MB–2GB) on first use.{" "}
    <strong>Anthropic</strong> / <strong>OpenAI</strong> are sharper and
    faster, but need a key and bill you per token. Same task either way; the
    trade-off is quality vs. cost &amp; privacy.
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
