import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Disagreement Digest — Conviqt's free weekly newsletter",
  description:
    "Every Monday: the five stocks Conviqt's AI research council split on hardest, with the crux of each fight and a link to the full cited analysis. Free, double opt-in, unsubscribe any time.",
  alternates: { canonical: "https://www.conviqt.com/newsletter" },
  openGraph: {
    title: "The Disagreement Digest | Conviqt",
    description:
      "The five most contested stocks each week — where Conviqt's AI analysts couldn't agree. Free weekly newsletter.",
    url: "https://www.conviqt.com/newsletter",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "The Disagreement Digest | Conviqt",
    description:
      "The five most contested stocks each week — where Conviqt's AI analysts couldn't agree. Free weekly newsletter.",
  },
};

export default function NewsletterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
