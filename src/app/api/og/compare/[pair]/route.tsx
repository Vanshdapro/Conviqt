import { ImageResponse } from "next/og";
import { VALID_TICKER_RE } from "@/lib/agents/router";
import { getCompareReport } from "@/lib/compareReports";
import { slugToComparePair, universeName } from "@/lib/tickers";
import type { Verdict } from "@/lib/agents/types";

// Shareable head-to-head card — the compare viral loop. Rendered on demand from
// the cached CompareResult (never re-runs the Compare, so crawlers/shares can't
// burn the budget). Mirrors /api/og/[ticker].
//
// nodejs runtime (not edge): getCompareReport reaches the file/Supabase store,
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

// Headline is one punchy line already; hard-cap so it never overflows.
function oneLine(text: string, max = 130): string {
  const s = text.trim().replace(/\s+/g, " ");
  if (s.length <= max) return s;
  return s.slice(0, max - 1).replace(/[\s,;:]+\S*$/, "") + "…";
}

// Fetch a Google font as TTF (satori can't parse woff2).
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
  { params }: { params: Promise<{ pair: string }> },
) {
  try {
    const { pair: slug } = await params;
    const pair = slugToComparePair(slug);
    if (!pair || !VALID_TICKER_RE.test(pair.a) || !VALID_TICKER_RE.test(pair.b)) {
      return new Response("Invalid pair", { status: 400 });
    }

    const stored = await getCompareReport(pair.a, pair.b);

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

    // ── Pending state: no Compare verdict yet ───────────────────────────────
    if (!stored) {
      const nameA = universeName(pair.a) ?? pair.a;
      const nameB = universeName(pair.b) ?? pair.b;
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
              CONVIQT COUNCIL · HEAD-TO-HEAD
            </div>
            <div style={{ display: "flex", flexDirection: "column", marginTop: "auto" }}>
              <div style={{ display: "flex", alignItems: "baseline", fontFamily: "Display", fontSize: 120, color: C.fg, lineHeight: 1 }}>
                {pair.a}
                <span style={{ color: C.dim, fontSize: 64, margin: "0 24px" }}>vs</span>
                {pair.b}
              </div>
              <div style={{ display: "flex", fontFamily: "Serif", fontSize: 28, color: C.muted, marginTop: 18 }}>
                {nameA} versus {nameB}
              </div>
              <div style={{ display: "flex", fontSize: 24, color: C.dim, marginTop: 24 }}>
                Awaiting head-to-head verdict — run the comparison at conviqt.com
              </div>
            </div>
          </div>
        ),
        { ...SIZE, fonts },
      );
    }

    const { tickerA, tickerB, winner, headline } = stored;
    const a = stored.report.a.judge;
    const b = stored.report.b.judge;

    // One side panel. The winning side gets the accent treatment.
    const SidePanel = ({
      ticker,
      verdict,
      conviction,
      isWinner,
    }: {
      ticker: string;
      verdict: Verdict;
      conviction: number;
      isWinner: boolean;
    }) => {
      const vc = verdictColor(verdict);
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            background: isWinner ? C.surface3 : C.surface,
            border: `1px solid ${isWinner ? C.accent : C.rule}`,
            padding: "28px 30px",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", fontFamily: "Display", fontSize: 72, color: C.fg, lineHeight: 1 }}>
              {ticker}
            </div>
            {isWinner && (
              <div style={{ display: "flex", color: C.accent, fontSize: 16, letterSpacing: 3 }}>
                WINNER
              </div>
            )}
          </div>
          <div style={{ display: "flex", fontFamily: "Display", fontSize: 46, color: vc, marginTop: 14 }}>
            {verdict}
          </div>
          <div style={{ display: "flex", color: C.dim, fontSize: 15, letterSpacing: 2, marginTop: 18 }}>
            CONVICTION {conviction}/100
          </div>
          <div style={{ display: "flex", width: "100%", height: 6, background: C.surface3, marginTop: 8 }}>
            <div style={{ display: "flex", width: `${conviction}%`, height: 6, background: vc }} />
          </div>
        </div>
      );
    };

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
            borderLeft: `12px solid ${C.accent}`,
          }}
        >
          {/* Brand row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "34px 56px 0 56px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ display: "flex", width: 10, height: 10, background: C.accent }} />
              <div style={{ display: "flex", color: C.accent, fontSize: 19, letterSpacing: 4 }}>
                CONVIQT COUNCIL
              </div>
            </div>
            <div style={{ display: "flex", color: C.dim, fontSize: 16, letterSpacing: 3 }}>
              HEAD-TO-HEAD
            </div>
          </div>

          {/* Two side panels with a center VS */}
          <div style={{ display: "flex", alignItems: "stretch", gap: 18, padding: "26px 56px 0 56px" }}>
            <SidePanel
              ticker={tickerA}
              verdict={a.verdict}
              conviction={a.conviction}
              isWinner={winner === "A"}
            />
            <div style={{ display: "flex", alignItems: "center", fontFamily: "Display", fontSize: 40, color: C.dim }}>
              vs
            </div>
            <SidePanel
              ticker={tickerB}
              verdict={b.verdict}
              conviction={b.conviction}
              isWinner={winner === "B"}
            />
          </div>

          {/* Headline — the shareable line */}
          <div style={{ display: "flex", padding: "30px 56px 0 56px" }}>
            <div style={{ display: "flex", fontFamily: "Serif", fontSize: 27, color: C.fg, lineHeight: 1.4 }}>
              “{oneLine(headline)}”
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginTop: "auto",
              padding: "0 56px 34px 56px",
              color: C.dim,
              fontSize: 17,
            }}
          >
            <div style={{ display: "flex" }}>Compared by Conviqt Council · conviqt.com</div>
            <div style={{ display: "flex" }}>Not investment advice</div>
          </div>
        </div>
      ),
      { ...SIZE, fonts },
    );
  } catch (err) {
    console.error("[og/compare] render failed", err);
    return new Response("Failed to render card", { status: 500 });
  }
}
