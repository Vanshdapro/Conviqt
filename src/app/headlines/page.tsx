import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/ui";

export const metadata: Metadata = {
  title: "Headlines",
  robots: { index: false, follow: false },
};

// Phase 2 holding page — the shell links here, so the route must exist and
// stay on-brand. The real Headlines feed (region tabs + Crypto, each headline
// with a plain-English take) is built in Phase 4 and replaces this file.
export default function HeadlinesPage() {
  return (
    <div style={{ padding: "var(--space-8) var(--space-6)", maxWidth: 720, margin: "0 auto" }}>
      <EmptyState
        title="Headlines are on their way"
        body="Market news from around the world, each with a one-line read on what it could mean for traders. It lands here soon."
        action={
          <Link href="/research" className="cvq-btn cvq-btn--primary">
            Look into a stock
          </Link>
        }
      />
    </div>
  );
}
