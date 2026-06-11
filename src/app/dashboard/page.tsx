import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Dashboard",
  robots: { index: false, follow: false },
};

// Phase 2 holding page — the shell links here, so the route must exist and
// stay on-brand. The real Dashboard (Market Snapshot, Today's Trends, Early
// Signals, Picks, Upcoming Events) is built in Phase 4 and replaces this file.
export default function DashboardPage() {
  return (
    <div style={{ padding: "var(--space-8) var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <EmptyState
        title="The Dashboard is on its way"
        body="A daily read on the market — what's moving, what's worth noticing, and our public picks with wins and losses alike. It lands here soon."
        action={
          <Link href="/research" className="cvq-btn cvq-btn--primary">
            Look into a stock
          </Link>
        }
      />
    </div>
  );
}
