import { ImageResponse } from "next/og";
import { OG, loadOgFonts } from "@/lib/og/brand";

// The sitewide share card — Almanac brand (playbook Phase 6): warm paper,
// espresso ink, one teal accent, the real type pairing. nodejs runtime so the
// self-hosted TTFs load from disk (no CDN fetch at render time).

export const runtime = "nodejs";
export const alt = "Conviqt — Your personal team of AI analysts";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage() {
  const fonts = await loadOgFonts();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: OG.page,
          padding: "56px 72px",
          fontFamily: "General",
          borderTop: `10px solid ${OG.accent}`,
        }}
      >
        {/* Brand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Cabinet",
              fontWeight: 800,
              fontSize: 34,
              letterSpacing: "0.12em",
              color: OG.text,
            }}
          >
            CONVI<span style={{ color: OG.accent }}>Q</span>T
          </div>
          <div style={{ display: "flex", fontSize: 20, color: OG.muted }}>conviqt.com</div>
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
          <div
            style={{
              display: "flex",
              fontFamily: "Cabinet",
              fontWeight: 800,
              fontSize: 84,
              lineHeight: 1.05,
              letterSpacing: "-0.015em",
              color: OG.text,
              maxWidth: 980,
            }}
          >
            Your personal team of AI analysts.
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              lineHeight: 1.45,
              color: OG.text2,
              marginTop: 22,
              maxWidth: 860,
            }}
          >
            Ask anything about any stock. Plain-English answers, and a public track record we
            can&rsquo;t hide from.
          </div>
        </div>

        {/* Credibility strip */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: 48,
            paddingTop: 26,
            borderTop: `1px solid ${OG.border}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              fontFamily: "Cabinet",
              fontWeight: 700,
              fontSize: 22,
              color: OG.accentHover,
            }}
          >
            <span>Every pick public</span>
            <span style={{ color: OG.borderStrong }}>·</span>
            <span>100 lessons</span>
            <span style={{ color: OG.borderStrong }}>·</span>
            <span>No download needed</span>
          </div>
          <div style={{ display: "flex", fontSize: 18, color: OG.muted }}>
            Research &amp; education — not financial advice
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
