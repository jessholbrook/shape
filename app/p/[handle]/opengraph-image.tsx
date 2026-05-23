import { ImageResponse } from "next/og";
import { getHandleArtifactsForMeta } from "@/lib/supabase/server-artifacts";

export const runtime = "edge";
export const alt = "Shape profile preview";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProfileOgImage({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const artifacts = await getHandleArtifactsForMeta(handle);
  const count = artifacts.length;
  const sub =
    count === 0
      ? "No public artifacts yet"
      : `${count} public ${count === 1 ? "artifact" : "artifacts"}`;

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
        <div
          style={{
            fontSize: 22,
            letterSpacing: 4,
            textTransform: "uppercase",
            color: "#6B6B6B",
            fontWeight: 600,
          }}
        >
          Shape · Profile
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 160,
              lineHeight: 0.95,
              letterSpacing: -4,
              fontWeight: 500,
              color: "#1A1A1A",
            }}
          >
            {`@${handle}`}
          </div>
          <div
            style={{
              fontSize: 36,
              lineHeight: 1.3,
              color: "#4A4A4A",
            }}
          >
            {sub}
          </div>
        </div>

        <div
          style={{
            fontSize: 22,
            letterSpacing: 3,
            textTransform: "uppercase",
            color: "#6B6B6B",
          }}
        >
          shape.so · published artifacts
        </div>
      </div>
    ),
    { ...size },
  );
}
