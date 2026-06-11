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
  "Conviqt is an AI equity research platform where five specialist AI agents debate every stock and return one cited BUY/HOLD/SELL verdict. Every number links to a live web source you can verify.";

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
    a: "Conviqt is an AI equity research platform. When you ask it about a stock, five specialist AI agents — covering fundamentals, technicals, sentiment, and macro — independently analyze it and a sixth Judge agent synthesizes them into a single BUY, HOLD, or SELL verdict with a conviction score. Every quantitative claim links to the live web source it came from.",
  },
  {
    q: "How is Conviqt different from ChatGPT or asking an AI for stock picks?",
    a: "A general chatbot answers in one voice and can invent numbers. Conviqt runs a structured council of agents that must cite a real, clickable source URL for every figure — if a fact has no source, it is dropped, never invented. It also publishes a disagreement score so you can see when the agents conflict, and a public Alpha Tracker with the full track record of every call, winners and losers included.",
  },
  {
    q: "Is Conviqt free to use?",
    a: "Conviqt has a free tier that lets you run AI stock analysis, plus paid plans for heavier usage and a developer API. You can see current plans on the pricing page.",
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
    q: "Can I use Conviqt's research in my own app?",
    a: "Yes. Conviqt offers a developer API: POST a ticker to /v1/analyze with a bearer key and receive the Council's verdict, conviction, disagreement score, and source-linked research as JSON. See the developers page for documentation.",
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

const SERIF = "var(--font-serif), Georgia, serif";
const DISPLAY = "var(--font-display), Georgia, serif";
const INK = "#e8edf8";
const DIM = "rgba(232,237,248,0.62)";
const ACCENT = "rgba(140,200,255,0.9)";

export default function AboutPage() {
  return (
    <div style={{ minHeight: "100vh", background: "#050d1a", color: INK }}>
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
          fontFamily: "var(--font-sans), system-ui, sans-serif",
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
          <strong>Conviqt is an AI equity research platform.</strong> Ask it about
          any stock and five specialist AI agents — fundamentals, technicals,
          sentiment, and macro — debate it in parallel. A sixth Judge agent
          synthesizes their views into one verdict: <strong>BUY, HOLD, or SELL</strong>,
          with a conviction score and a disagreement score.
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
          When the agents conflict, Conviqt does not hide it. It publishes a
          disagreement score and surfaces the dissenting cases. A contested setup is
          often the most valuable thing to know about a stock.
        </Section>

        <Section title="A public, unedited track record">
          The{" "}
          <Link href="/alpha" style={{ color: ACCENT }}>
            Alpha Tracker
          </Link>{" "}
          publishes every call — winners and losers — with the original thesis and
          exit reason. Nothing is quietly deleted.
        </Section>

        <Section title="Built for investors, not beginners">
          Conviqt is for active retail investors, finance students, and junior
          analysts who want fast, source-linked research. Read the full{" "}
          <Link href="/methodology" style={{ color: ACCENT }}>
            methodology
          </Link>{" "}
          or call it programmatically through the{" "}
          <Link href="/developers" style={{ color: ACCENT }}>
            developer API
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
                borderTop: "1px solid rgba(232,237,248,0.1)",
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
            borderTop: "1px solid rgba(232,237,248,0.1)",
            display: "flex",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <Link
            href="/"
            style={{
              background: ACCENT,
              color: "#050d1a",
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
              border: "1px solid rgba(232,237,248,0.25)",
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
      <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(232,237,248,0.72)", margin: 0 }}>
        {children}
      </p>
    </div>
  );
}
