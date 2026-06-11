// Self-hosted Almanac type pairing (playbook Jobs 3 + Part 2.1).
//
//   Cabinet Grotesk  -> display: headlines, big numbers, hero, wordmark
//   General Sans     -> UI/body/data tables (tabular figures ON for numbers)
//
// Both from Fontshare (free + commercially licensed), self-hosted via
// next/font/local from downloaded .woff2 — NEVER a CDN <link>. next/font emits
// the --font-cabinet / --font-general custom properties on whatever element we
// attach the className to; tokens.css maps those into --font-display / --font-ui.

import localFont from "next/font/local";

export const cabinetGrotesk = localFont({
  src: [
    { path: "../fonts/CabinetGrotesk-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/CabinetGrotesk-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/CabinetGrotesk-700.woff2", weight: "700", style: "normal" },
    { path: "../fonts/CabinetGrotesk-800.woff2", weight: "800", style: "normal" },
  ],
  variable: "--font-cabinet",
  display: "swap",
  fallback: ["Georgia", "Times New Roman", "serif"],
});

export const generalSans = localFont({
  src: [
    { path: "../fonts/GeneralSans-400.woff2", weight: "400", style: "normal" },
    { path: "../fonts/GeneralSans-500.woff2", weight: "500", style: "normal" },
    { path: "../fonts/GeneralSans-600.woff2", weight: "600", style: "normal" },
    { path: "../fonts/GeneralSans-700.woff2", weight: "700", style: "normal" },
  ],
  variable: "--font-general",
  display: "swap",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

/** Combined className for <html> — emits both --font-* custom properties. */
export const fontVars = `${cabinetGrotesk.variable} ${generalSans.variable}`;
