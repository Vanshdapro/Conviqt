import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Conviqt — Five AI agents. One disagreement signal.",
  description:
    "AI-generated equity research with a transparent disagreement signal across five specialist agents. Every recommendation tracked publicly.",
  metadataBase: new URL("https://conviqt.com"),
};

// NOTE: Using <link> tags for Google Fonts instead of next/font/google.
// next/font/google was causing silent hangs at boot when the Google CDN
// was slow or blocked. This runtime approach falls back to system fonts
// gracefully if the network is unavailable.
const FONT_VARS = {
  "--font-sans":
    "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  "--font-mono":
    "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
  "--font-serif":
    "'Lora', 'Georgia', 'Times New Roman', serif",
  "--font-display":
    "'DM Serif Display', 'Lora', Georgia, serif",
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
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Lora:ital,wght@0,400;0,500;0,600;1,400;1,500&family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500&display=swap"
        />
      </head>
      <body className="min-h-full flex flex-col relative">{children}</body>
    </html>
  );
}
