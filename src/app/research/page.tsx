import type { Metadata } from "next";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { ResearchHub } from "@/components/research/ResearchHub";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Conviqt Research — ask the AI Council to analyze any ticker on demand, or run a deep five-agent audit of your whole portfolio for hidden concentration, sector, macro, and correlation risk.",
  alternates: { canonical: "https://www.conviqt.com/research" },
  openGraph: {
    title: "Conviqt Research | Analyst + Portfolio Auditor",
    description:
      "Two surfaces: the Analyst runs the Council on any ticker; the Portfolio Auditor stress-tests your whole book with five risk agents and a transparent disagreement score.",
    url: "https://www.conviqt.com/research",
    type: "website",
  },
};

export default function ResearchPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <ResearchTabs active="overview" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <ResearchHub />
      </main>
    </div>
  );
}
