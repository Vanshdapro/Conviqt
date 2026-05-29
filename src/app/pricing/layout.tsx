import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Start free with 50 credits every month. Upgrade for unlimited AI equity research — no lock-in, cancel any time.",
  alternates: { canonical: "https://www.conviqt.com/pricing" },
  openGraph: {
    title: "Pricing | Conviqt",
    description:
      "Start free with 50 credits every month. Upgrade for unlimited AI equity research.",
    url: "https://www.conviqt.com/pricing",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Pricing | Conviqt",
    description:
      "Start free with 50 credits every month. Upgrade for unlimited AI equity research.",
  },
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
