import type { Metadata, Viewport } from "next";
import "./globals.css";
import { TranslationProvider } from "@/components/i18n/TranslationProvider";
import Analytics from "@/components/analytics/Analytics";

const SITE_URL = "https://www.conviqt.com";
const SITE_NAME = "Conviqt";
const TITLE = "Conviqt — AI Equity Research. Cited. Accountable.";
const DESCRIPTION =
  "Five AI agents debate every stock with live web data. Every number has a source URL. Alpha Tracker shows every trade — winners and losers.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | Conviqt",
  },
  description: DESCRIPTION,
  keywords: [
    "Conviqt",
    "AI equity research",
    "stock analysis AI",
    "AI stock research",
    "AI stock analysis tool",
    "equity research platform",
    "stock research tool",
    "AI investing",
    "stock analysis",
    "financial research AI",
    "cited stock research",
    "transparent AI research",
    "alpha tracker",
    "stock picks AI",
  ],
  authors: [{ name: "Conviqt", url: SITE_URL }],
  creator: "Conviqt",
  publisher: "Conviqt",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: DESCRIPTION,
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "Conviqt — AI Equity Research",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
    creator: "@conviqt",
    site: "@conviqt",
  },
  icons: {
    icon: [
      { url: "/icon.png", sizes: "64x64", type: "image/png" },
      { url: "/favicon.png", sizes: "64x64", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.png",
  },
  manifest: "/site.webmanifest",
  // NOTE: no site-wide `alternates.canonical` here. A canonical set on the root
  // layout is inherited by every child page that doesn't override it, which
  // would wrongly point pages like /developers at the homepage and de-index
  // them. Each page sets its own canonical; the homepage's lives in page.tsx.
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#050d1a",
};

// Script fallbacks (Chinese / Devanagari / Arabic) are appended to every font
// chain so translated copy — including headings — renders real glyphs instead
// of tofu boxes when Conviqt Translate switches language.
const SCRIPT_FALLBACKS =
  "'Noto Sans SC', 'Noto Sans Devanagari', 'Noto Sans Arabic'";

// Fonts are loaded in two non-render-blocking requests (see <head> below):
//   1. Latin — the families the default English site actually paints.
//   2. Noto  — CJK / Devanagari / Arabic script fallbacks, only needed once
//      Conviqt Translate switches to a non-Latin language. Splitting these out
//      keeps the heavy CJK @font-face blocks off the critical path on every
//      page (the big LCP/FCP win) without changing the --font-* cascade, so the
//      glyph fallback still resolves once the deferred sheet lands.
const FONTS_LATIN =
  "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&family=Playfair+Display:ital,wght@0,400;0,500;0,600;1,400;1,500&family=Source+Serif+4:opsz,wght@8..60,300;8..60,400;8..60,500&display=swap";
const FONTS_NOTO =
  "https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@400;500;700&family=Noto+Sans+Devanagari:wght@400;500;700&family=Noto+Sans+Arabic:wght@400;500;700&display=swap";

const FONT_VARS = {
  "--font-sans":
    `'Inter', ${SCRIPT_FALLBACKS}, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`,
  "--font-mono":
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  "--font-serif":
    `'Source Serif 4', ${SCRIPT_FALLBACKS}, Georgia, 'Times New Roman', serif`,
  "--font-display":
    `'Playfair Display', ${SCRIPT_FALLBACKS}, Georgia, 'Times New Roman', serif`,
} as React.CSSProperties;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      alternateName: "Conviqt AI Equity Research",
      url: SITE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${SITE_URL}/icon-512.png`,
        width: 512,
        height: 512,
      },
      description: DESCRIPTION,
      slogan: "AI Equity Research. Cited. Accountable.",
      // sameAs ties this entity to its official profiles — a strong signal for
      // Google's Knowledge Graph and for disambiguating Conviqt (the product)
      // from "CONVIQT" the 2022 video-quality research paper. Add each official
      // profile URL here as it goes live (Instagram, X, LinkedIn, etc.).
      sameAs: [],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${SITE_URL}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: SITE_NAME,
      url: SITE_URL,
      applicationCategory: "FinanceApplication",
      operatingSystem: "Web",
      description: DESCRIPTION,
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased" style={FONT_VARS}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Async font loading: media="print" makes the browser fetch the CSS
            without blocking first paint. The <Analytics> client component flips
            media to "all" right after hydration (display=swap keeps text visible
            meanwhile), so SSR and the initial client render are IDENTICAL —
            no hydration mismatch even with React 19's stylesheet hoisting. The
            <noscript> path keeps fonts working with JS disabled. */}
        <link rel="stylesheet" href={FONTS_LATIN} media="print" id="cvq-fonts-latin" />
        <link rel="stylesheet" href={FONTS_NOTO} media="print" id="cvq-fonts-noto" />
        <noscript>
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href={FONTS_LATIN} />
          {/* eslint-disable-next-line @next/next/no-page-custom-font */}
          <link rel="stylesheet" href={FONTS_NOTO} />
        </noscript>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col relative">
        <TranslationProvider>{children}</TranslationProvider>
        <Analytics />
      </body>
    </html>
  );
}
