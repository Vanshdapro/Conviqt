import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";
import { ResearchSurface } from "@/components/research/ResearchSurface";

// Research — the home of the logged-in app (playbook 2.2, Phase 3).
// Server component: resolves the session user's first name for the greeting,
// then hands off to the client surface.

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Research",
  description:
    "Ask anything about any stock and get a plain-English answer with live market data — fast take or deep dive, plus one-tap skills like Worth Owning?, Face-Off, and Sector Pulse.",
  // Logged-in app surface — keep it out of the index so crawl budget goes to
  // the public pages (/stock, /compare), same policy the old /chat page had.
  robots: { index: false, follow: true },
  alternates: { canonical: "https://www.conviqt.com/research" },
  openGraph: {
    title: "Conviqt Research",
    description:
      "Plain-English stock research: ask anything, pick a skill, get an honest verdict with live data.",
    url: "https://www.conviqt.com/research",
    type: "website",
  },
};

export default async function ResearchPage() {
  const user = await getSessionUser();
  const rawFirst = user?.name?.trim().split(/\s+/)[0] ?? null;
  // Stored names are sometimes all-lowercase; greet politely either way.
  const firstName = rawFirst
    ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1)
    : null;

  return (
    <main>
      <ResearchSurface firstName={firstName} />
    </main>
  );
}
