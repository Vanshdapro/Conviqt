import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How the Council Works",
  description:
    "How Conviqt works: a live web sweep gathers sourced facts, four specialist AI analysts study fundamentals, technicals, sentiment, and macro, and their views become one cited, plain-English verdict.",
  alternates: { canonical: "https://www.conviqt.com/methodology" },
  openGraph: {
    title: "How the Council Works | Conviqt",
    description:
      "Every Conviqt analysis runs a team of AI analysts against live web data. No hallucinations — every number cites its source URL.",
    url: "https://www.conviqt.com/methodology",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How the Council Works | Conviqt",
    description:
      "Every Conviqt analysis runs a team of AI analysts against live web data. No hallucinations — every number cites its source URL.",
  },
};

export default function MethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
