import Link from "next/link";

// edu.conviqt.com landing. Three tools, one philosophy: dead-simple controls,
// deterministic macro engine behind. No coding, no prompting.

const TOOLS = [
  {
    href: "/sandbox",
    kicker: "What-if modelling",
    title: "Research Sandbox",
    body: "Drag sliders for interest rates, inflation, and corporate tax. A historical asset chart reshapes to your scenario — with a plain-English read on why.",
  },
  {
    href: "/wedge",
    kicker: "Distortion analysis",
    title: "Market Wedge Finder",
    body: "Search a ticker or sector. See fundamental value against the actual market price, the gap shaded, and the distortion named and sourced.",
  },
  {
    href: "/thesis",
    kicker: "Citation-ready",
    title: "Thesis Hub",
    body: "One click for a clean CSV of any analysis. One click for a formatted APA, Harvard, or Chicago citation — straight to your clipboard.",
  },
];

export default function EduLanding() {
  return (
    <>
      <section className="edu-hero">
        <h1>Macro-financial research, one click deep.</h1>
        <p>
          Built for MSc Finance &amp; Economics. Simple controls on the surface;
          a deterministic, citable model underneath. Every number traces to
          public-domain data and disclosed assumptions.
        </p>
      </section>

      <section className="edu-cards">
        {TOOLS.map((t) => (
          <Link key={t.href} href={t.href} className="edu-card">
            <span className="edu-kicker">{t.kicker}</span>
            <h3>{t.title}</h3>
            <p>{t.body}</p>
          </Link>
        ))}
      </section>
    </>
  );
}
