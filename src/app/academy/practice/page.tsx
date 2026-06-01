import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { AcademyTabs } from "@/components/academy/AcademyTabs";
import { PracticeDashboard } from "@/components/practice/PracticeDashboard";

// Per-user rank/XP/credits resolve at runtime — never statically prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Practice — Academy",
  description:
    "Conviqt Academy · Practice — the desk where you apply the curriculum. Trade real historical episodes bar by bar (the COVID crash, Nvidia's AI run, the SVB collapse), climb a boss-fight ladder toward a PM certification, and write theses an AI grades section by section.",
  alternates: { canonical: "https://www.conviqt.com/academy/practice" },
  openGraph: {
    title: "Conviqt Academy · Practice | Trade real episodes, get AI-graded",
    description:
      "Put every lesson to work. Manage real historical positions under fire, write a PM-grade thesis, and get detailed AI feedback. Process beats luck — and the desk grades both.",
    url: "https://www.conviqt.com/academy/practice",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviqt Academy · Practice",
    description:
      "Trade real historical market episodes bar by bar and get AI-graded on your process — not just your P&L.",
  },
};

export default function AcademyPracticePage() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 15% 60%, rgba(180,120,30,0.28) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(160,100,20,0.20) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(120,75,15,0.18) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)" }}>
      <DashNav active="academy" />
      <AcademyTabs active="practice" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <PracticeDashboard />
      </main>
    </div>
  );
}
