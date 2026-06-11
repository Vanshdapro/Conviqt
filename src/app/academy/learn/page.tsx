import type { Metadata } from "next";
import { AcademyTabs } from "@/components/academy/AcademyTabs";
import { LearnDashboard } from "@/components/learn/LearnDashboard";

// Per-user XP/credits resolve at runtime — never statically prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn — Academy",
  description:
    "Conviqt Academy · Learn — gamified, interactive financial literacy. Budgeting, investing, and how markets really work, with hands-on playgrounds and a direct line into the AI Council.",
  alternates: { canonical: "https://www.conviqt.com/academy/learn" },
  openGraph: {
    title: "Conviqt Academy · Learn | Interactive financial literacy",
    description:
      "Get money-smart one interactive lesson at a time. Budgeting, investing, and markets — with playgrounds you can poke at and real AI analysis behind it.",
    url: "https://www.conviqt.com/academy/learn",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviqt Academy · Learn",
    description:
      "Interactive, gamified financial literacy — budgeting, investing, and markets, the way they should be taught.",
  },
};

export default function AcademyLearnPage() {
  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 15% 60%, rgba(180,120,30,0.28) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(160,100,20,0.20) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(120,75,15,0.18) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)" }}>
      <AcademyTabs active="learn" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <LearnDashboard />
      </main>
    </div>
  );
}
