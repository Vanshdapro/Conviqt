import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "../styles/tokens.css";
import "../styles/app.css";
import { fontVars } from "@/lib/fonts";
import { AppFrame } from "@/components/shell/AppShell";
import { ThemeToggle } from "@/components/ui";
import Analytics from "@/components/analytics/Analytics";

// No-flash theme bootstrap: applies the saved choice to <html> BEFORE first
// paint so a dark-mode user never sees a white flash. Light is the default —
// absence of the attribute resolves to the light tokens in tokens.css.
const THEME_INIT = `(function(){try{var t=localStorage.getItem('conviqt-theme');if(t==='dark'){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`;

const SITE_URL = "https://www.conviqt.com";
const SITE_NAME = "Conviqt";
const TITLE = "Conviqt — Your personal team of AI analysts";
const DESCRIPTION =
  "Ask anything about any stock and get plain-English answers backed by live market data — plus a public track record we can't hide from, losses included.";

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
    "stock track record",
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
  // iOS Safari "Add to Home Screen": these emit apple-mobile-web-app-* meta so
  // the installed icon launches standalone (no browser chrome) with a warm-paper
  // status bar — the app must feel installable with no App Store presence yet.
  appleWebApp: {
    capable: true,
    title: "Conviqt",
    statusBarStyle: "default",
  },
  // NOTE: no site-wide `alternates.canonical` here. A canonical set on the root
  // layout is inherited by every child page that doesn't override it, which
  // would wrongly point pages like /pricing at the homepage and de-index
  // them. Each page sets its own canonical; the homepage's lives in page.tsx.
  category: "finance",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Almanac light theme — warm-paper page background (--bg-page).
  themeColor: "#F5EFE1",
};

// Google Ads conversion tag. Fire ONLY on the production deploy — never from
// localhost or a Vercel preview, where it would pollute real conversion data.
// ID is overridable via NEXT_PUBLIC_GOOGLE_ADS_ID.
const GOOGLE_ADS_ID =
  process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "AW-18214353433";
const ADS_TAG_ENABLED = process.env.VERCEL_ENV === "production";

// The Almanac type pairing (Cabinet Grotesk + General Sans) is SELF-HOSTED via
// next/font/local (see src/lib/fonts.ts) — no CDN <link>. The Noto script
// fallbacks died with Conviqt Translate (Phase 8): the UI is English-only.
//
// Map the next/font custom properties (--font-cabinet / --font-general, emitted
// by the className on <html>) into the cascade the app + legacy pages read.
// tokens.css also defines --font-display / --font-ui from these; this inline set
// additionally rebinds the legacy --font-sans/-serif/-display vars onto the new
// brand so pre-rebrand pages inherit Almanac type instead of Inter/Playfair.
const FONT_VARS = {
  "--font-sans": `var(--font-general), system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`,
  "--font-serif": `var(--font-general), system-ui, sans-serif`,
  "--font-display": `var(--font-cabinet), Georgia, "Times New Roman", serif`,
  "--font-mono": "ui-monospace, SFMono-Regular, Menlo, monospace",
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
      sameAs: [
        "https://www.instagram.com/conviqt",
        "https://x.com/conviqt",
      ],
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
    <html
      lang="en"
      className={`h-full antialiased ${fontVars}`}
      style={FONT_VARS}
      // The no-flash script (THEME_INIT) sets data-theme on <html> before React
      // hydrates, so the server (always light) and client markup differ by one
      // attribute here. This is the intended theme pattern — suppress the warning
      // for this element only (does not cascade to children).
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col relative">
        <AppFrame>{children}</AppFrame>
        <ThemeToggle />
        <Analytics />
        {ADS_TAG_ENABLED && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${GOOGLE_ADS_ID}`}
              strategy="lazyOnload"
            />
            <Script id="google-ads-config" strategy="lazyOnload">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GOOGLE_ADS_ID}');`}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
