import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  alternates: { canonical: "https://www.conviqt.com" },
};

// Phase 2 placeholder landing. The 3D intro + particle canvas are retired; the
// full Almanac marketing page (wordmark reveal, track record, founder note,
// pricing) is built in Phase 6. Until then this is a clean, on-brand holding
// page — warm paper, espresso ink, teal accent, zero non-token colour.
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--bg-page)",
        color: "var(--text)",
        fontFamily: "var(--font-ui)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "var(--space-8) var(--space-6)",
        gap: "var(--space-6)",
      }}
    >
      <span
        data-no-translate
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 800,
          fontSize: "clamp(34px, 7vw, 56px)",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}
      >
        CONVI<span style={{ color: "var(--accent)" }}>Q</span>T
      </span>

      <p
        style={{
          maxWidth: "32ch",
          fontFamily: "var(--font-display)",
          fontSize: "clamp(20px, 4vw, 28px)",
          lineHeight: 1.25,
          color: "var(--text)",
          margin: 0,
        }}
      >
        Your personal team of AI analysts.
      </p>

      <p style={{ maxWidth: "46ch", fontSize: "16px", lineHeight: 1.5, color: "var(--text-2)", margin: 0 }}>
        Ask anything about any stock. Plain-English answers, live market data, and
        a public track record we can&rsquo;t hide from — losses included.
      </p>

      <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", justifyContent: "center", marginTop: "var(--space-2)" }}>
        <Link href="/signup" className="cvq-btn cvq-btn--primary">
          Start free
        </Link>
        <Link href="/research" className="cvq-btn cvq-btn--secondary">
          Open the app
        </Link>
      </div>

      <p style={{ fontSize: "12px", color: "var(--text-muted)", maxWidth: "52ch", lineHeight: 1.5, marginTop: "var(--space-6)" }}>
        Conviqt is a research and education tool, not a licensed financial adviser.
        Nothing here is financial advice. Markets involve risk.
      </p>
    </main>
  );
}
