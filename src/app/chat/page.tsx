import type { Metadata } from "next";
import { ResearchTabs } from "@/components/research/ResearchTabs";
import ChatWithQuery from "@/components/ChatWithQuery";

// Gated app surface (login-protected, no static content) — keep it out of the
// index so crawl budget goes to the public research pages instead.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function ChatPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#050d1a" }}>
      <ResearchTabs active="analyst" />
      <ChatWithQuery />
    </div>
  );
}
