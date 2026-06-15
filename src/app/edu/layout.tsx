import type { Metadata } from "next";
import Link from "next/link";
import "./edu.css";

// Conviqt for Academia — the edu.conviqt.com shell. Rendered for /edu/* only;
// the retail AppFrame is allowlist-gated (showsShell) and yields bare children
// here, so this provides the entire chrome. Same Almanac tokens, academic skin.

export const metadata: Metadata = {
  title: {
    default: "Conviqt for Academia",
    template: "%s | Conviqt for Academia",
  },
  description:
    "One-click macro-financial research for MSc Finance & Economics — interactive what-if modelling, fundamental-vs-market wedges, and citation-ready exports. No coding required.",
};

const NAV = [
  { href: "/sandbox", label: "Research Sandbox" },
  { href: "/wedge", label: "Wedge Finder" },
  { href: "/thesis", label: "Thesis Hub" },
];

export default function EduLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="edu-root">
      <header className="edu-topbar">
        <Link href="/" className="edu-wordmark">
          Conviqt<span className="edu-sub">for Academia</span>
        </Link>
        <nav className="edu-nav" aria-label="Academic portal">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
      </header>

      <main className="edu-main">{children}</main>

      <footer className="edu-footer">
        Conviqt is a research and education tool, not a licensed financial
        adviser. Nothing here is financial advice. Markets involve risk. All
        modelled values are computed from public-domain data and disclosed
        assumptions — see each tool&apos;s methodology note.
      </footer>
    </div>
  );
}
