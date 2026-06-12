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
    <div>
      <AcademyTabs active="overview" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <AcademyHub totalLessons={TOTAL_LESSONS} />
      </main>
    </div>
  );
}
