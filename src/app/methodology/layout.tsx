import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How the Council Works",
  description:
    "Conviqt's five-agent AI Council: Sweep gathers live web data, four specialists debate fundamentals, technicals, sentiment, and macro, then the Judge synthesizes a final verdict with full source citations.",
  alternates: { canonical: "https://conviqt.com/methodology" },
  openGraph: {
    title: "How the Council Works | Conviqt",
    description:
      "Every Conviqt analysis runs five AI agents against live web data. No hallucinations — every number cites its source URL.",
    url: "https://conviqt.com/methodology",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "How the Council Works | Conviqt",
    description:
      "Every Conviqt analysis runs five AI agents against live web data. No hallucinations — every number cites its source URL.",
  },
};

export default function MethodologyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
