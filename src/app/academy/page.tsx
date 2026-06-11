import type { Metadata } from "next";
import { AcademyTabs } from "@/components/academy/AcademyTabs";
import { AcademyHub } from "@/components/academy/AcademyHub";
import { TOTAL_LESSONS } from "@/lib/learn/curriculum";

// Per-user progress resolves at runtime — never statically prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Academy",
  description:
    "Conviqt Academy — learn how markets, risk, sizing, and valuation actually work, then prove it on the Practice desk: trade real historical episodes bar by bar and write theses an AI grades like a portfolio manager.",
  alternates: { canonical: "https://www.conviqt.com/academy" },
  openGraph: {
    title: "Conviqt Academy | Learn the model, then run it",
    description:
      "Two halves: Learn builds the mental model, Practice makes you do it. Trade the COVID crash and Nvidia's AI run bar by bar, climb to a PM certification, and get AI feedback on your theses.",
    url: "https://www.conviqt.com/academy",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviqt Academy",
    description:
      "Learn how investing actually works, then prove you can run it on real historical episodes — with AI-graded theses.",
  },
};

export default function AcademyPage() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 15% 60%, rgba(180,120,30,0.28) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(160,100,20,0.20) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(120,75,15,0.18) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)" }}>
      <AcademyTabs active="overview" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <AcademyHub totalLessons={TOTAL_LESSONS} />
      </main>
    </div>
  );
}
