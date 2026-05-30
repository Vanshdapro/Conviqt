import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { LearnDashboard } from "@/components/learn/LearnDashboard";

// Per-user XP/credits resolve at runtime — never statically prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Learn",
  description:
    "Conviqt Learn — gamified, interactive financial literacy. Budgeting, investing, and how markets really work, with hands-on playgrounds and a direct line into the AI Council. Built for curious minds.",
  alternates: { canonical: "https://www.conviqt.com/learn" },
  openGraph: {
    title: "Conviqt Learn | Interactive financial literacy",
    description:
      "Get money-smart one interactive lesson at a time. Budgeting, investing, and markets — with playgrounds you can poke at and real AI analysis behind it.",
    url: "https://www.conviqt.com/learn",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviqt Learn",
    description:
      "Interactive, gamified financial literacy — budgeting, investing, and markets, the way they should be taught.",
  },
};

export default function LearnPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050d1a" }}>
      <DashNav active="learn" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <LearnDashboard />
      </main>
    </div>
  );
}
