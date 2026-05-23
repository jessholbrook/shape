import { ImageResponse } from "next/og";
import { getArtifactForMeta } from "@/lib/supabase/server-artifacts";

export const runtime = "edge";
export const alt = "Shape artifact preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const KIND_LABEL: Record<string, string> = {
  diff: "Diff Log",
  tone: "Behavior Spec",
  persona: "Persona Card",
  refusal: "Refusal Scorecard",
  evals: "Eval Scorecard",
  choreographer: "Conversation",
  "case-study": "Case Study",
};

export default async function ArtifactOgImage({
  params,
}: {
  params: Promise<{ handle: string; slug: string }>;
}) {
  const { handle, slug } = await params;
  const artifact = await getArtifactForMeta(handle, slug);

  const title = artifact?.title ?? slug.replace(/-/g, " ");
  const kindLabel = artifact ? KIND_LABEL[artifact.kind] ?? "Artifact" : "Artifact";
  const summary = artifact?.summary ?? "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#F4F1EA",
          color: "#1A1A1A",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: "#1A1A1A",
              fontWeight: 600,
            }}
          >
            Shape
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            ·
          </div>
          <div
            style={{
              fontSize: 18,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            {kindLabel}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 88,
              lineHeight: 1.05,
              letterSpacing: -2,
              fontWeight: 500,
              color: "#1A1A1A",
              maxWidth: 1000,
            }}
          >
            {truncate(title, 70)}
          </div>
          {summary && (
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.4,
                color: "#4A4A4A",
                maxWidth: 1000,
              }}
            >
              {truncate(summary, 140)}
            </div>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              fontSize: 22,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: "#6B6B6B",
            }}
          >
            BY
          </div>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 1,
              color: "#1A1A1A",
              padding: "8px 20px",
              borderRadius: 999,
              background: "#FFD84D",
              fontWeight: 600,
            }}
          >
            {`@${handle}`}
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return s.slice(0, n - 1).trimEnd() + "…";
}
