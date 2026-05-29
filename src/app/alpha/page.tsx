import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { AlphaGate } from "@/components/AlphaGate";

// Never statically prerender — picks + unlock state are per-user at runtime.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Alpha Tracker",
  description:
    "Conviqt's public paper-trade track record. Every pick the Council made — buys, sells, stops — with full P&L. We publish winners and losers.",
  alternates: { canonical: "https://conviqt.com/alpha" },
  openGraph: {
    title: "Alpha Tracker | Conviqt",
    description:
      "Full track record: every AI-generated stock pick, entry price, stop loss, and outcome. No cherry-picking.",
    url: "https://conviqt.com/alpha",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Alpha Tracker | Conviqt",
    description:
      "Full track record: every AI-generated stock pick, entry price, stop loss, and outcome. No cherry-picking.",
  },
};

export default function AlphaPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050d1a" }}>
      <DashNav active="alpha" />
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 24px" }}>
        <AlphaGate />
      </main>
    </div>
  );
}
