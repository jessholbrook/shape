"use client";

import { useState } from "react";
import { downloadBlob } from "@/lib/download";

/**
 * Per-output Copy / Download buttons. Copy puts `copyText` on the clipboard;
 * Download saves `markdown` (defaults to `copyText`) as a dated .md file.
 * Styled to sit in the small mono action rows the playgrounds use.
 */
export function ShareActions({
  copyText,
  filenameStem,
  markdown,
}: {
  copyText: string;
  filenameStem: string;
  markdown?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* best effort */
    }
  }

  function download() {
    const date = new Date().toISOString().split("T")[0];
    downloadBlob(
      `${filenameStem}-${date}.md`,
      "text/markdown",
      markdown ?? copyText,
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={copy}
        className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        {copied ? "Copied" : "Copy"}
      </button>
      <button
        type="button"
        onClick={download}
        className="font-mono text-[10px] uppercase tracking-[0.08em] text-ink-muted hover:text-ink"
      >
        Download
      </button>
    </>
  );
}
