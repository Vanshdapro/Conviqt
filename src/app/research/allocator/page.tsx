import type { Metadata } from "next";
import { DashNav } from "@/components/DashNav";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import { AllocatorClient } from "@/components/allocator/AllocatorClient";
import { CREDITS_PER_INTENT } from "@/lib/credits";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "The Allocator",
  description:
    "Tell the Council your investing capacity, risk tolerance, time horizon, and goals — and get a personalized, cited allocation plan: exact tickers, dollar splits, account priority, and a clear read on what fits your profile and what doesn't.",
  alternates: { canonical: "https://www.conviqt.com/research/allocator" },
  openGraph: {
    title: "The Allocator | Conviqt Research",
    description:
      "Four planning agents turn your money and goals into a specific, cited allocation plan.",
    url: "https://www.conviqt.com/research/allocator",
    type: "website",
  },
};

export default function AllocatorPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background:
          "radial-gradient(ellipse at 15% 60%, rgba(30,90,180,0.22) 0%, transparent 55%), radial-gradient(ellipse at 85% 20%, rgba(20,70,160,0.18) 0%, transparent 55%), radial-gradient(ellipse at 50% 95%, rgba(15,60,120,0.16) 0%, transparent 50%), linear-gradient(175deg, #060b12 0%, #0b1020 60%, #07090f 100%)",
      }}
    >
      <DashNav active="research" />
      <ResearchTabs active="allocator" />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 80px" }}>
        <AllocatorClient cost={CREDITS_PER_INTENT.allocator} />
      </main>
    </div>
  );
}
