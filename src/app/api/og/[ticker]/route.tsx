import { ImageResponse } from "next/og";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { getStockReport } from "@/lib/stockReports";
import { slugToTicker, universeName } from "@/lib/tickers";
import type { Verdict } from "@/lib/agents/types";

// Shareable verdict card — the viral loop. Rendered on demand from the cached
// Council report (never re-runs the Council, so crawlers/shares can't burn the
// budget). Stateless, no external image API, no per-share cost.
//
// nodejs runtime (not edge): getStockReport reaches the file/Supabase store,
// which pulls in `fs` and the Supabase client — neither bundles on edge.

export const runtime = "nodejs";
export const revalidate = 86400; // match the page's 24h ISR window

// ── Palette (mirrors globals.css; satori needs literal hex, not CSS vars) ───
const C = {
  bg: "#050d1a",
  surface: "#0a1323",
  surface3: "#0f1d35",
  rule: "#1a2944",
  fg: "#e8edf8",
  muted: "#7a92b8",
  dim: "#3d5278",
  accent: "#4f87f7",
  bull: "#22c55e",
  bear: "#ef4444",
  hold: "#f59e0b",
} as const;

function verdictColor(v: Verdict): string {
  if (v === "BUY") return C.bull;
  if (v === "SELL") return C.bear;
  return C.hold;
}

function disagreementLabel(d: number): string {
  if (d >= 60) return "HIGH";
  if (d >= 30) return "MODERATE";
  return "LOW";
}

// Bull/bear cases are 2-3 sentences; the card wants one punchy line. Take the
// first sentence, then hard-cap so it never overflows the row.
function oneLine(text: string, max = 110): string {
  const firstSentence = text.trim().match(/^.*?[.!?](?:\s|$)/)?.[0] ?? text;
  const s = firstSentence.trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/[\s,;:]+\S*$/, "") + "…";
}

// Fetch a Google font as TTF (satori can't parse woff2). A plain fetch UA gets
// truetype back from the css2 endpoint.
async function loadFont(family: string, weight: number): Promise<ArrayBuffer> {
  const url = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(
    family,
  )}:wght@${weight}&display=swap`;
  const css = await (await fetch(url)).text();
  const src = css.match(/src: url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
  if (!src) throw new Error(`font url not found for ${family}`);
  return (await fetch(src)).arrayBuffer();
}

const SIZE = { width: 1200, height: 630 };

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ ticker: string }> },
) {
  try {
    const { ticker } = await params;
    const TICK = slugToTicker(ticker);
    if (!VALID_TICKER_RE.test(TICK)) {
      return new Response("Invalid ticker", { status: 400 });
    }

    const stored = await getStockReport(TICK);

    const [display, mono, serif] = await Promise.all([
      loadFont("Playfair Display", 600),
      loadFont("JetBrains Mono", 500),
      loadFont("Source Serif 4", 400),
    ]);
    const fonts = [
      { name: "Display", data: display, weight: 600 as const, style: "normal" as const },
      { name: "Mono", data: mono, weight: 500 as const, style: "normal" as const },
      { name: "Serif", data: serif, weight: 400 as const, style: "normal" as const },
    ];

    // ── Pending state: no Council report yet ────────────────────────────────
    if (!stored) {
      const name = universeName(TICK) ?? TICK;
      return new ImageResponse(
        (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              flexDirection: "column",
              background: C.bg,
              padding: "64px 72px",
              fontFamily: "Mono",
              borderLeft: `12px solid ${C.accent}`,
            }}
          >
            <div style={{ display: "flex", color: C.accent, fontSize: 20, letterSpacing: 4 }}>
              CONVIQT COUNCIL
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
              <div style={{ display: "flex", fontFamily: "Display", fontSize: 150, color: C.fg, lineHeight: 1 }}>
                {TICK}
              </div>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 32, color: C.muted, marginTop: 12 }}>
                {name}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: C.dim, marginTop: 28 }}>
                Awaiting Council verdict — run the analysis at conviqt.com
              </div>
            </div>
          </div>
        ),
        { ...SIZE, fonts },
      );
    }

    const { verdict, conviction, disagreement, companyName } = stored;
    const vc = verdictColor(verdict);
    const dLabel = disagreementLabel(disagreement);
    const bull = oneLine(stored.report.judge.bullCase);
    const bear = oneLine(stored.report.judge.bearCase);

    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: C.bg,
            fontFamily: "Mono",
            borderLeft: `12px solid ${vc}`,
          }}
        >
          {/* Subtle top hairline + brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "34px 64px 0 64px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", width: 10, height: 10, background: C.accent }} />
              <div style={{ display: "flex", color: C.accent, fontSize: 19, letterSpacing: 4 }}>
                CONVIQT COUNCIL
              </div>
            </div>
            <div style={{ display: "flex", color: C.dim, fontSize: 16, letterSpacing: 3 }}>
              AI EQUITY RESEARCH
            </div>
          </div>

          {/* Ticker + verdict */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "22px 64px 0 64px",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", maxWidth: 720 }}>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Display",
                  fontSize: 122,
                  color: C.fg,
                  lineHeight: 1,
                }}
              >
                {TICK}
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Serif",
                  fontSize: 28,
                  color: C.muted,
                  marginTop: 14,
                }}
              >
                {companyName}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
              <div style={{ display: "flex", color: C.dim, fontSize: 15, letterSpacing: 3 }}>
                VERDICT
              </div>
              <div
                style={{
                  display: "flex",
                  fontFamily: "Display",
                  fontSize: 96,
                  color: vc,
                  lineHeight: 1,
                  marginTop: 6,
                }}
              >
                {verdict}
              </div>
            </div>
          </div>

          {/* Scores row */}
          <div style={{ display: "flex", gap: 20, padding: "28px 64px 0 64px" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.rule}`,
                padding: "20px 24px",
              }}
            >
              <div style={{ display: "flex", color: C.dim, fontSize: 14, letterSpacing: 2 }}>
                CONVICTION
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
                <div style={{ display: "flex", fontFamily: "Display", fontSize: 52, color: C.fg }}>
                  {conviction}
                </div>
                <div style={{ display: "flex", fontSize: 22, color: C.muted, marginLeft: 4 }}>
                  /100
                </div>
              </div>
              <div style={{ display: "flex", width: "100%", height: 6, background: C.surface3, marginTop: 12 }}>
                <div style={{ display: "flex", width: `${conviction}%`, height: 6, background: vc }} />
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                background: C.surface,
                border: `1px solid ${C.rule}`,
                padding: "20px 24px",
              }}
            >
              <div style={{ display: "flex", color: C.dim, fontSize: 14, letterSpacing: 2 }}>
                AGENT DISAGREEMENT
              </div>
              <div style={{ display: "flex", alignItems: "baseline", marginTop: 8 }}>
                <div style={{ display: "flex", fontFamily: "Display", fontSize: 52, color: C.fg }}>
                  {dLabel}
                </div>
                <div style={{ display: "flex", fontSize: 22, color: C.muted, marginLeft: 10 }}>
                  {disagreement}/100
                </div>
              </div>
              <div style={{ display: "flex", width: "100%", height: 6, background: C.surface3, marginTop: 12 }}>
                <div style={{ display: "flex", width: `${disagreement}%`, height: 6, background: C.muted }} />
              </div>
            </div>
          </div>

          {/* Bull / Bear one-liners */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12, padding: "26px 64px 0 64px" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  color: C.bull,
                  fontSize: 15,
                  letterSpacing: 2,
                  width: 56,
                  flexShrink: 0,
                  paddingTop: 4,
                }}
              >
                BULL
              </div>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 23, color: C.fg, lineHeight: 1.35 }}>
                {bull}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 16 }}>
              <div
                style={{
                  display: "flex",
                  color: C.bear,
                  fontSize: 15,
                  letterSpacing: 2,
                  width: 56,
                  flexShrink: 0,
                  paddingTop: 4,
                }}
              >
                BEAR
              </div>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 23, color: C.fg, lineHeight: 1.35 }}>
                {bear}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              padding: "0 64px 34px 64px",
              color: C.dim,
              fontSize: 17,
            }}
          >
            <div style={{ display: "flex" }}>Analyzed by Conviqt Council · conviqt.com</div>
            <div style={{ display: "flex" }}>Not investment advice</div>
          </div>
        </div>
      ),
      { ...SIZE, fonts },
    );
  } catch (err) {
    console.error("[og] render failed", err);
    return new Response("Failed to render card", { status: 500 });
  }
}
