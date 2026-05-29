import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "Conviqt — AI Equity Research";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#050508",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "Georgia, serif",
          position: "relative",
        }}
      >
        {/* Subtle grid background */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Blue accent line top */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, #1a6bff 0%, #4fa3ff 50%, #1a6bff 100%)",
          }}
        />

        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 24,
            padding: "0 80px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 400,
              color: "#f5f0e8",
              letterSpacing: "0.18em",
              lineHeight: 1,
            }}
          >
            CONVIQT
          </div>
          <div
            style={{
              fontSize: 28,
              color: "#4fa3ff",
              letterSpacing: "0.08em",
              fontFamily: "monospace",
            }}
          >
            AI Equity Research
          </div>
          <div
            style={{
              fontSize: 20,
              color: "rgba(255,255,255,0.45)",
              maxWidth: 700,
              lineHeight: 1.5,
              marginTop: 8,
            }}
          >
            Five AI agents debate every stock with live web data.
            Every number has a source URL.
          </div>
        </div>

        {/* Bottom label */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 12,
            color: "rgba(255,255,255,0.3)",
            fontSize: 16,
            letterSpacing: "0.12em",
            fontFamily: "monospace",
          }}
        >
          <span>conviqt.com</span>
          <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
          <span>Cited. Accountable.</span>
        </div>
      </div>
    ),
    { ...size }
  );
}
