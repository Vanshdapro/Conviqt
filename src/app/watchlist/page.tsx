import type { Metadata } from "next";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { WatchlistClient } from "@/components/watchlist/WatchlistClient";

export const dynamic = "force-dynamic";

const INK = "#e8edf8";
const MUTED = "#8aa0c2";
const FAINT = "#526684";
const ACCENT = "#4f87f7";
const MONO = "var(--font-mono), 'JetBrains Mono', monospace";
const SANS = "var(--font-sans), system-ui, sans-serif";
const DISPLAY = "var(--font-display), Georgia, 'Times New Roman', serif";
const SERIF = "var(--font-serif), Georgia, serif";

export const metadata: Metadata = {
  title: "Watchlist — earnings & disagreement alerts",
  description:
    "Track up to 10 tickers and get an email the moment one reports earnings within 48 hours or the Council fractures on it. The bear case, before the call.",
  alternates: { canonical: "https://www.conviqt.com/watchlist" },
  robots: { index: false }, // gated, per-user surface — not an SEO page
};

export default function WatchlistPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <ResearchTabs active="watchlist" />

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "48px 24px 80px", fontFamily: SANS }}>
        <header style={{ marginBottom: 34, maxWidth: 720 }}>
          <div style={{ color: ACCENT, fontFamily: MONO, fontSize: 10, letterSpacing: "0.26em", textTransform: "uppercase", marginBottom: 18 }}>
            Conviqt Research · Watchlist
          </div>
          <h1 style={{ color: INK, fontFamily: DISPLAY, fontSize: 46, lineHeight: 1.05, letterSpacing: "-0.02em", fontWeight: 500, margin: "0 0 18px" }}>
            Never get caught off guard before earnings.
          </h1>
          <p style={{ color: MUTED, fontFamily: SERIF, fontSize: 17, lineHeight: 1.62, margin: 0, maxWidth: 660 }}>
            Track up to ten tickers. We&rsquo;ll email you the moment one reports earnings within 48 hours — or the moment a fresh Council run fractures on it past 40% disagreement. That&rsquo;s exactly when you want the bear case in front of you.
          </p>
        </header>

        <WatchlistClient />

        <footer style={{ marginTop: 40, paddingTop: 16, borderTop: `1px solid ${FAINT}33`, color: FAINT, fontSize: 12, lineHeight: 1.6 }}>
          Analysis only, not personalized financial advice. Earnings dates are gathered from live web search and may shift — confirm with the company&rsquo;s investor relations before trading.
        </footer>
      </main>
    </div>
  );
}
