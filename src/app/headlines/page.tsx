import type { Metadata } from "next";
import { HeadlinesFeed } from "@/components/headlines/HeadlinesFeed";

export const metadata: Metadata = {
  title: "Headlines",
  robots: { index: false, follow: false },
};

// Headlines (playbook Phase 4): region tabs + Crypto, five headlines each
// with a one-line "why traders care" take. Tapping a headline is the PRIMARY
// way to run Headline Decoder — it lands in Research pre-filled, never
// copy-pasted. Content is the globally shared 2×/day cache; the client
// component fetches /api/headlines per tab.
export default function HeadlinesPage() {
  return (
    <main>
      <HeadlinesFeed />
    </main>
  );
}
