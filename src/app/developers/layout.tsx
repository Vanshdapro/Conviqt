import type { Metadata } from "next";

const TITLE = "Conviqt API — AI Equity Research API for Developers";
const DESCRIPTION =
  "Call Conviqt's AI Council from your own app. POST a ticker to /v1/analyze and get a BUY/HOLD/SELL verdict, conviction score, and source-linked research as JSON. Bearer-key auth, usage-based plans.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  keywords: [
    "stock research API",
    "equity research API",
    "AI stock analysis API",
    "financial data API",
    "stock verdict API",
    "Conviqt API",
  ],
  alternates: { canonical: "https://www.conviqt.com/developers" },
  openGraph: {
    type: "website",
    url: "https://www.conviqt.com/developers",
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function DevelopersLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
