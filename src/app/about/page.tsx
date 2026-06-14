import type { Metadata } from "next";
import Link from "next/link";

// Server-rendered brand page. The homepage is a client-side 3D animation, so
// crawlers and LLMs see very little text there. This page is the opposite:
// plain, server-rendered prose that defines the Conviqt entity unambiguously,
// plus FAQ structured data so search engines and AI assistants can answer
// "what is Conviqt?" correctly.

const BASE = "https://www.conviqt.com";

const TITLE = "About Conviqt — What Is Conviqt?";
const DESCRIPTION =
  "Conviqt is your personal team of AI analysts: specialist analysts study every stock independently and return one cited, plain-English verdict. Every number links to a live web source you can verify.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${BASE}/about` },
  openGraph: {
    type: "website",
    url: `${BASE}/about`,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
};

const FAQ: { q: string; a: string }[] = [
  {
    q: "What is Conviqt?",
    a: "Conviqt is your personal team of AI analysts. Ask about any stock and specialist analysts — fundamentals, technicals, sentiment, and macro — each study it independently, then their views are pulled into one plain-English verdict that tells you how sure the team is. Every number links to the live web source it came from.",
  },
  {
    q: "How is Conviqt different from ChatGPT or asking an AI for stock picks?",
    a: "A general chatbot answers in one voice and can invent numbers. Conviqt's analysts must cite a real, clickable source for every figure — if a fact has no source, it is dropped, never invented. When the analysts disagree, the report says so plainly. And every published pick lands on a public track record, winners and losers included.",
  },
  {
    q: "Is Conviqt free to use?",
    a: "Yes — Free includes 5 deep analyses every month, quick takes, Headlines, the fundamentals Academy track, and full access to the public track record. Pro ($8/month, month to month, 7-day free trial) opens unlimited fair-use analyses, the full Academy, and the portfolio tools. Current plans are on the pricing page.",
  },
  {
    q: "How accurate is Conviqt, and is it financial advice?",
    a: "Conviqt is a research tool, not financial advice, and it never claims to beat the market — it markets transparency, not guaranteed returns. Its value is that every claim is source-linked and every published call is tracked openly so you can judge the reasoning yourself.",
  },
  {
    q: "What stocks does Conviqt cover?",
    a: "Conviqt can analyze any valid ticker on demand. The S&P 500 and major Nasdaq names have warm, pre-built research pages, and any other ticker is generated on request against live web data.",
  },
  {
    q: "Do I need to know finance to use Conviqt?",
    a: "No. Conviqt is built for beginner and intermediate investors: every report reads in plain English, concepts link to short Academy lessons that explain them, and the fundamentals track of the Academy is free for everyone.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

const appJsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Conviqt",
  alternateName: "Conviqt AI Equity Research",
  url: BASE,
  applicationCategory: "FinanceApplication",
  operatingSystem: "Web",
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
};

const SERIF = "var(--font-ui)";
const DISPLAY = "var(--font-display), Georgia, serif";
const INK = "var(--text)";
const DIM = "var(--text-2)";
const ACCENT = "var(--accent)";

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", color: INK }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(appJsonLd) }}
      />

      <main
        style={{
          maxWidth: 760,
          margin: "0 auto",
          padding: "64px 24px 96px",
          fontFamily: "var(--font-ui)",
        }}
      >
        <p
          style={{
            fontFamily: "var(--font-mono), monospace",
            fontSize: 12,
            letterSpacing: "0.18em",
            textTransform: "uppercase",
            color: ACCENT,
            marginBottom: 18,
          }}
        >
          About Conviqt
        </p>

        <h1
          style={{
            fontFamily: DISPLAY,
            fontSize: "clamp(34px, 6vw, 52px)",
            lineHeight: 1.08,
            fontWeight: 500,
            margin: "0 0 24px",
          }}
        >
          What is Conviqt?
        </h1>

        <p style={{ fontSize: 19, lineHeight: 1.6, color: INK, margin: "0 0 20px", fontFamily: SERIF }}>
          <strong>Conviqt is your personal team of AI analysts.</strong> Ask it
          about any stock and specialist analysts — fundamentals, technicals,
          sentiment, and macro — study it independently. Their views become one
          plain-English verdict, with an honest reading of how sure the team is
          and where they disagree.
        </p>

        <p style={{ fontSize: 17, lineHeight: 1.65, color: DIM, margin: "0 0 40px" }}>
          The rule that defines Conviqt: every number it shows links to a live web
          source you can click and verify. If a fact has no source URL, it is
          dropped — never invented. Conviqt markets transparency, not a promise to
          beat the market.
        </p>

        <Section title="Cited, not hallucinated">
          Every quantitative claim in a Conviqt report carries the exact URL it was
          pulled from. No citation, no claim. That is what separates it from a
          general-purpose chatbot that can confidently make numbers up.
        </Section>

        <Section title="Disagreement is the signal">
          When the analysts conflict, Conviqt does not hide it. The report says
          where they split and why. A contested setup is often the most valuable
          thing to know about a stock.
        </Section>

        <Section title="A public, unedited track record">
          The{" "}
          <Link href="/dashboard" style={{ color: ACCENT }}>
            Dashboard
          </Link>{" "}
          publishes every pick — winners and losers — with the original thesis and
          exit reason. Nothing is quietly deleted.
        </Section>

        <Section title="Built for people starting out">
          Conviqt is for beginner and intermediate investors who want research
          they can actually read — and learn from. Every concept links to a short
          Academy lesson. The curious can read the full{" "}
          <Link href="/methodology" style={{ color: ACCENT }}>
            methodology
          </Link>
          .
        </Section>

        <h2
          style={{
            fontFamily: DISPLAY,
            fontSize: 28,
            fontWeight: 500,
            margin: "56px 0 8px",
          }}
        >
          Frequently asked questions
        </h2>

        <div style={{ marginTop: 24 }}>
          {FAQ.map((f) => (
            <div
              key={f.q}
              style={{
                borderTop: "1px solid var(--border)",
                padding: "22px 0",
              }}
            >
              <h3 style={{ fontSize: 18, fontWeight: 600, margin: "0 0 10px", color: INK }}>
                {f.q}
              </h3>
              <p style={{ fontSize: 16, lineHeight: 1.6, color: DIM, margin: 0 }}>{f.a}</p>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 56,
            paddingTop: 32,
            borderTop: "1px solid var(--border)",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              background: ACCENT,
              color: "var(--bg-page)",
              padding: "12px 22px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            Analyze a stock →
          </Link>
          <Link
            href="/pricing"
            style={{
              border: "1px solid var(--border-strong)",
              color: INK,
              padding: "12px 22px",
              borderRadius: 8,
              fontWeight: 600,
              fontSize: 15,
              textDecoration: "none",
            }}
          >
            See pricing
          </Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ margin: "0 0 30px" }}>
      <h2 style={{ fontSize: 19, fontWeight: 600, margin: "0 0 8px", color: INK }}>{title}</h2>
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "var(--text)", margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
