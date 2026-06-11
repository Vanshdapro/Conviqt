import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Portfolio",
  robots: { index: false, follow: false },
};

// Phase 2 holding page — the shell links here, so the route must exist and
// stay on-brand. The real Portfolio surface (holdings + watching tab, live
// values, health stats, AI Health Check) is built in Phase 5 and replaces
// this file.
export default function PortfolioPage() {
  return (
    <div style={{ padding: "var(--space-8) var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <EmptyState
        title="Portfolio is on its way"
        body="Track what you own and what you're watching, with live values and plain-English health stats. It lands here soon."
        action={
          <Link href="/research" className="cvq-btn cvq-btn--primary">
            Look into a stock
          </Link>
        }
      />
    </div>
  );
}
