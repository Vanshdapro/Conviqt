import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { AcademyTabs } from "@/components/academy/AcademyTabs";
import { Leaderboard } from "@/components/practice/Leaderboard";
import { getSessionUser } from "@/lib/auth";
import { getProfile } from "@/lib/practice/leaderboard";

// Per-viewer self-highlight + claim CTA resolve at runtime — never prerender.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Leaderboard — Academy",
  description:
    "The Conviqt paper-desk leaderboard. Every trader runs a notional $100k account on real, cited prices and is ranked by a risk-adjusted weekly return — disciplined sizing beats lottery tickets.",
  alternates: { canonical: "https://www.conviqt.com/academy/leaderboard" },
  openGraph: {
    title: "Conviqt Academy · Paper Desk Leaderboard",
    description:
      "Notional $100k accounts, real cited prices, ranked by risk-adjusted return. Climb the weekly board on process, not luck.",
    url: "https://www.conviqt.com/academy/leaderboard",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Conviqt Academy · Paper Desk Leaderboard",
    description: "Notional $100k accounts ranked by risk-adjusted weekly return — process beats luck.",
  },
};

export default async function AcademyLeaderboardPage() {
  let signedIn = false;
  let hasHandle = false;
  try {
    const user = await getSessionUser();
    if (user) {
      signedIn = true;
      const profile = await getProfile(user.email);
      hasHandle = Boolean(profile?.handle);
    }
  } catch {
    // Public board still renders for anonymous viewers.
  }

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at 15% 60%, rgba(180,120,30,0.28) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(160,100,20,0.20) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(120,75,15,0.18) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)" }}>
      <DashNav active="academy" />
      <AcademyTabs active="leaderboard" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <Leaderboard signedIn={signedIn} hasHandle={hasHandle} />
      </main>
    </div>
  );
}
