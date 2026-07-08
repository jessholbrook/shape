"use client";

import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown in the root layout itself. It
 * replaces the whole document, so it can't rely on the app's layout, fonts,
 * or stylesheet — everything here is inline and self-contained. Rare by
 * design; the per-route error.tsx handles the common cases with full styling.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f5f4f2",
          color: "#1a1a1a",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "460px" }}>
          <div
            style={{
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: "11px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "#8a8680",
            }}
          >
            Error
          </div>
          <h1
            style={{
              fontSize: "40px",
              lineHeight: 1.1,
              fontWeight: 700,
              margin: "12px 0 0",
            }}
          >
            Something broke.
          </h1>
          <p
            style={{
              fontSize: "16px",
              lineHeight: 1.55,
              color: "#5a5751",
              margin: "16px 0 0",
            }}
          >
            The app hit an unexpected error. Your saved drafts live in this
            browser and are untouched. Reload to try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "24px",
              backgroundColor: "#1a1a1a",
              color: "#f5f4f2",
              border: "none",
              borderRadius: "12px",
              padding: "12px 24px",
              fontSize: "15px",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
