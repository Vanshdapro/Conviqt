import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { PortfolioAuditor } from "@/components/portfolio/PortfolioAuditor";
import { CREDITS_PER_INTENT } from "@/lib/credits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Portfolio Auditor",
  description:
    "Run a five-agent deep audit of your whole portfolio — concentration, sector overlap, macro fragility, correlation, and hidden single-stock exposure — with a health score, what-if stress tests, and ranked rebalancing ideas.",
  alternates: { canonical: "https://www.conviqt.com/research/portfolio" },
  openGraph: {
    title: "Portfolio Auditor | Conviqt Research",
    description:
      "Five risk agents stress-test your basket and show you exactly where they disagree.",
    url: "https://www.conviqt.com/research/portfolio",
    type: "website",
  },
};

export default function PortfolioAuditorPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <DashNav active="research" />
      <ResearchTabs active="portfolio" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <PortfolioAuditor cost={CREDITS_PER_INTENT.portfolio_audit} />
      </main>
    </div>
  );
}
