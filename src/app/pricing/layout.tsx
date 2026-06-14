import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free: 5 deep analyses a month, quick takes, and our full public track record. Pro is $8/month, month to month, with a 7-day free trial.",
  alternates: { canonical: "https://www.conviqt.com/pricing" },
  openGraph: {
    title: "Pricing | Conviqt",
    description:
      "Start free. Pro is $8/month, month to month, with a 7-day free trial — cancel anytime.",
    url: "https://www.conviqt.com/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Conviqt",
    description:
      "Start free. Pro is $8/month, month to month, with a 7-day free trial — cancel anytime.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
