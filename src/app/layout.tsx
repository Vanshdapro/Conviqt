import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conviqt — AI Equity Research. Cited. Accountable.",
  description:
    "Five AI agents debate every stock with live web data. Every number has a source URL. Alpha Tracker shows every trade — winners and losers.",
  metadataBase: new URL("https://conviqt.com"),
  icons: { icon: "/logo.png" },
};

const FONT_VARS = {
  "--font-sans":
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-mono":
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  "--font-serif":
    "'Inter', -apple-system, sans-serif",
  "--font-display":
    "'Inter', -apple-system, sans-serif",
} as React.CSSProperties;

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
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col relative">{children}</body>
    </html>
  );
}
