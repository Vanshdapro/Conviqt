// Almanac brand for the OG image generators (playbook Phase 6).
//
// satori renders off-DOM and can't resolve CSS custom properties, so this is
// the ONE sanctioned mirror of src/styles/tokens.css for image generation —
// if a token changes there, change it here too. No other file may hardcode
// brand hex values.
//
// Fonts: satori can't parse woff2, so the OG routes use TTF copies of the
// self-hosted brand fonts (src/fonts/og/, converted from the same Fontshare
// woff2 files next/font/local serves). No CDN fetch at render time.

import { readFile } from "fs/promises";
import { fileURLToPath } from "url";

export const OG = {
  /* neutrals — warm paper */
  page: "#F5EFE1",
  surface: "#FCFAF5",
  sunken: "#E7DFC6",
  border: "#DED2B8",
  borderStrong: "#C9B991",
  /* ink — espresso, never pure black */
  text: "#2A1C15",
  text2: "#63372C",
  muted: "#7A6A5A",
  /* accent — teal */
  accent: "#0E7978",
  accentHover: "#0A5F5D",
  accentWeak: "#D6E7E5",
  onAccent: "#FBF7EC",
  /* market data — gains/losses only */
  upInk: "#0A6F79",
  upWeak: "#D5EFF1",
  downInk: "#AF4138",
  downWeak: "#F8DEDB",
} as const;

export function ogVerdictColor(v: "BUY" | "HOLD" | "SELL"): string {
  if (v === "BUY") return OG.upInk;
  if (v === "SELL") return OG.downInk;
  return OG.text2; // HOLD — neither gain nor loss
}

// `new URL(..., import.meta.url)` with a static literal is traced by the
// bundler, so the TTFs ship with the serverless function automatically — no
// outputFileTracingIncludes config needed.
async function ttf(url: URL): Promise<ArrayBuffer> {
  const buf = await readFile(fileURLToPath(url));
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

export interface OgFont {
  name: string;
  data: ArrayBuffer;
  weight: 500 | 600 | 700 | 800;
  style: "normal";
}

/** Cabinet Grotesk (display) + General Sans (UI) for ImageResponse. */
export async function loadOgFonts(): Promise<OgFont[]> {
  const [cab800, cab700, gen500, gen600] = await Promise.all([
    ttf(new URL("../../fonts/og/CabinetGrotesk-800.ttf", import.meta.url)),
    ttf(new URL("../../fonts/og/CabinetGrotesk-700.ttf", import.meta.url)),
    ttf(new URL("../../fonts/og/GeneralSans-500.ttf", import.meta.url)),
    ttf(new URL("../../fonts/og/GeneralSans-600.ttf", import.meta.url)),
  ]);
  return [
    { name: "Cabinet", data: cab800, weight: 800, style: "normal" },
    { name: "Cabinet", data: cab700, weight: 700, style: "normal" },
    { name: "General", data: gen500, weight: 500, style: "normal" },
    { name: "General", data: gen600, weight: 600, style: "normal" },
  ];
}
