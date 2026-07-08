/**
 * Shared social-card artwork for the OpenGraph and Twitter image routes.
 * Rendered by next/og's ImageResponse (satori), so everything is inline
 * styles and flexbox — no Tailwind, no CSS variables. Colors are the brand
 * tokens copied as literals.
 */

const INK = "#1a1a1a";
const CANVAS = "#f5f4f2";
const INK_MUTED = "#5a5751";
const INK_QUIET = "#8a8680";
const HIGHLIGHT = "#ff3d2e";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_ALT =
  "Shape — a playground for learning to design how an AI behaves.";
export const OG_CONTENT_TYPE = "image/png";

export function OgCard() {
  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        backgroundColor: CANVAS,
        padding: "80px",
        fontFamily: "sans-serif",
      }}
    >
      {/* Brand row */}
      <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
        <div
          style={{
            position: "relative",
            width: "56px",
            height: "56px",
            borderRadius: "16px",
            backgroundColor: INK,
            display: "flex",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "8px",
              right: "8px",
              width: "14px",
              height: "14px",
              borderRadius: "999px",
              backgroundColor: HIGHLIGHT,
            }}
          />
        </div>
        <div style={{ fontSize: "40px", fontWeight: 600, color: INK }}>
          Shape
        </div>
      </div>

      {/* Headline */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        <div
          style={{
            fontSize: "82px",
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.02em",
            color: INK,
            maxWidth: "960px",
          }}
        >
          Design how an AI{" "}
          <span style={{ color: HIGHLIGHT }}>behaves</span>.
        </div>
        <div
          style={{
            fontSize: "32px",
            lineHeight: 1.4,
            color: INK_MUTED,
            maxWidth: "880px",
          }}
        >
          A hands-on playground for UX designers and researchers to learn the
          craft — tone, persona, and boundaries.
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
        <div style={{ width: "40px", height: "6px", backgroundColor: HIGHLIGHT }} />
        <div
          style={{
            fontSize: "26px",
            color: INK_QUIET,
            letterSpacing: "0.02em",
          }}
        >
          shape-models.com
        </div>
      </div>
    </div>
  );
}
