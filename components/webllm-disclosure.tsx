/**
 * Expandable "What gets downloaded?" explainer for the Free in-browser model
 * option. Beta-tester feedback: a 1GB blob landing in their browser without
 * a single word about what it was made them anxious. This is the answer.
 */
export function WebLLMDisclosure() {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none font-mono text-[11px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink inline-flex items-center gap-1.5">
        <span className="inline-block transition-transform group-open:rotate-90">
          ›
        </span>
        What gets downloaded?
      </summary>
      <div className="mt-3 ml-4 pl-4 border-l-2 border-line flex flex-col gap-2 font-sans text-[13px] leading-[1.55] text-ink-muted max-w-xl">
        <p>
          When you first open a playground on the Free option, your browser
          downloads two things:
        </p>
        <ul className="list-disc pl-5 flex flex-col gap-1">
          <li>
            <strong className="text-ink">Model weights</strong> — a large file
            of numbers (~280 MB–2 GB depending on which model). Open source,
            published by Meta (Llama) and others.
          </li>
          <li>
            <strong className="text-ink">A small WebAssembly runtime</strong>{" "}
            from{" "}
            <a
              href="https://webllm.mlc.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="text-ink underline decoration-highlight underline-offset-4 decoration-2"
            >
              MLC WebLLM
            </a>{" "}
            that runs the weights on your GPU.
          </li>
        </ul>
        <p className="mt-1">
          Both live in this browser&apos;s IndexedDB and Cache for this
          origin. Nothing is uploaded to a Shape server. The model runs in the
          same WebAssembly + WebGPU sandbox every webpage uses — it can&apos;t
          read your files, your network, or other sites.
        </p>
        <p>
          You can wipe it any time with{" "}
          <strong className="text-ink">Clear local model</strong> below, or
          via your browser&apos;s &ldquo;clear site data&rdquo; for this
          origin.
        </p>
      </div>
    </details>
  );
}
