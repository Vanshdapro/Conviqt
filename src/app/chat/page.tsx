import Link from "next/link";
import Image from "next/image";
import ChatWithQuery from "@/components/ChatWithQuery";

function DashNav() {
  return (
    <header style={{ borderBottom: "1px solid rgba(79,135,247,0.1)", background: "rgba(6,12,24,0.95)", backdropFilter: "blur(20px)", position: "sticky", top: 0, zIndex: 50, flexShrink: 0 }}>
      <div style={{ maxWidth: 1400, margin: "0 auto", padding: "0 24px", height: 56, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <Image src="/logo1.png" alt="Conviqt" width={24} height={24} style={{ objectFit: "contain" }} />
          <span style={{ fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 15, color: "#e8edf8", letterSpacing: "-0.4px" }}>Conviqt</span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: 4 }}>
          {([
            { label: "Research", href: "/chat", active: true },
            { label: "Alpha Tracker", href: "/alpha", active: false },
            { label: "Methodology", href: "/methodology", active: false },
          ] as const).map(({ label, href, active }) => (
            <Link
              key={href}
              href={href}
              style={{
                fontFamily: "'Inter', sans-serif",
                fontWeight: active ? 600 : 400,
                fontSize: 13,
                color: active ? "#4f87f7" : "rgba(122,146,184,0.65)",
                padding: "6px 14px",
                borderRadius: 7,
                textDecoration: "none",
                borderBottom: active ? "2px solid #4f87f7" : "2px solid transparent",
                transition: "color 0.15s",
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}

export default function ChatPage() {
  return (
    <div className="flex flex-col min-h-screen" style={{ background: "#050d1a" }}>
      <DashNav />
      <ChatWithQuery />
    </div>
  );
}
