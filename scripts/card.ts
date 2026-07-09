#!/usr/bin/env npx tsx
// Conviqt premium Instagram card generator
// Outputs 7 carousel slides (1080×1350) to ~/Desktop/Conviqt/conviqt-instagram/cards/{TICKER}-{date}/
// Usage: npm run card -- MU

import { chromium } from "playwright-core";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { runCouncil } from "../src/lib/agents/orchestrator";
import { quote } from "../src/lib/marketdata";
import type { CouncilResult, AgentOutput } from "../src/lib/agents/types";
import type { Quote } from "../src/lib/marketdata";

// ── Fonts (base64 for HTML embedding) ────────────────────────────────────────

const FONT_DIR = path.resolve(fileURLToPath(import.meta.url), "../../src/fonts/og");
const b64 = (f: string) => fs.readFileSync(path.join(FONT_DIR, f)).toString("base64");
const FONTS = {
  cab800: b64("CabinetGrotesk-800.ttf"),
  cab700: b64("CabinetGrotesk-700.ttf"),
  gen600: b64("GeneralSans-600.ttf"),
  gen500: b64("GeneralSans-500.ttf"),
};

// ── Design tokens ─────────────────────────────────────────────────────────────

// Dark editorial — Conviqt brand on dark canvas
const T = {
  bg:       "#0E0906",
  bg2:      "#160C08",
  card:     "rgba(255,255,255,0.055)",
  border:   "rgba(255,255,255,0.10)",
  text:     "#F5EFE1",      // Almanac warm cream
  text2:    "#C8B49A",
  muted:    "#8A7060",
  accent:   "#12AEAC",      // teal brightened for dark bg
  accentDim:"rgba(18,174,172,0.14)",
  up:       "#22C9D8",
  upWeak:   "rgba(34,201,216,0.13)",
  down:     "#E3655B",
  downWeak: "rgba(227,101,91,0.13)",
  hold:     "#C9A44A",
  holdWeak: "rgba(201,164,74,0.13)",
};

function vc(v: string) { return v === "BUY" ? T.up : v === "SELL" ? T.down : T.hold; }
function vbg(v: string) { return v === "BUY" ? T.upWeak : v === "SELL" ? T.downWeak : T.holdWeak; }
function sc(s: string) { return s === "bullish" ? T.up : s === "bearish" ? T.down : T.muted; }

function trunc(s: string, max: number) {
  if (!s || s.length <= max) return s ?? "";
  return s.slice(0, max).replace(/\s\S*$/, "") + "…";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtPrice(p?: number | null) {
  if (p == null) return "—";
  return `$${p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtChange(c?: number | null) {
  if (c == null) return "";
  return `${c >= 0 ? "+" : ""}${c.toFixed(2)}%`;
}

// ── SVG gauge (semicircle, fills left→top→right) ──────────────────────────────

function gaugePoint(cx: number, cy: number, r: number, pct: number) {
  // pct=0 → left end, pct=50 → top, pct=100 → right end
  const angle = (pct / 100) * Math.PI;
  return {
    x: +(cx - r * Math.cos(angle)).toFixed(2),
    y: +(cy - r * Math.sin(angle)).toFixed(2),
  };
}

function gaugeSVG(value: number, color: string, size = 360): string {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.40;
  const strokeW = size * 0.055;
  const start = gaugePoint(cx, cy, r, 0);      // left
  const end100 = gaugePoint(cx, cy, r, 100);   // right
  const endVal = gaugePoint(cx, cy, r, value); // actual value
  const dot = gaugePoint(cx, cy, r * 0.97, value);

  return `<svg width="${size}" height="${Math.round(size * 0.62)}" viewBox="0 0 ${size} ${size * 0.62}">
    <!-- track -->
    <path d="M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${end100.x} ${end100.y}"
      fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="${strokeW}" stroke-linecap="round"/>
    <!-- fill -->
    <path d="M ${start.x} ${start.y} A ${r} ${r} 0 0 0 ${endVal.x} ${endVal.y}"
      fill="none" stroke="${color}" stroke-width="${strokeW}" stroke-linecap="round"/>
    <!-- end dot -->
    <circle cx="${dot.x}" cy="${dot.y}" r="${strokeW * 0.8}" fill="${color}"/>
    <!-- value -->
    <text x="${cx}" y="${cy - r * 0.05}" text-anchor="middle" dominant-baseline="middle"
      font-family="Cabinet" font-weight="800" font-size="${size * 0.22}" fill="${T.text}">${value}</text>
    <!-- labels -->
    <text x="${start.x + 4}" y="${start.y + 28}" font-family="General" font-weight="500"
      font-size="${size * 0.055}" fill="${T.muted}">FRAGILE</text>
    <text x="${end100.x - 4}" y="${end100.y + 28}" text-anchor="end" font-family="General"
      font-weight="500" font-size="${size * 0.055}" fill="${T.muted}">BUILT TO LAST</text>
  </svg>`;
}

// ── HTML shell ────────────────────────────────────────────────────────────────

function html(body: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
@font-face{font-family:'Cabinet';font-weight:800;src:url('data:font/truetype;base64,${FONTS.cab800}')format('truetype')}
@font-face{font-family:'Cabinet';font-weight:700;src:url('data:font/truetype;base64,${FONTS.cab700}')format('truetype')}
@font-face{font-family:'General';font-weight:600;src:url('data:font/truetype;base64,${FONTS.gen600}')format('truetype')}
@font-face{font-family:'General';font-weight:500;src:url('data:font/truetype;base64,${FONTS.gen500}')format('truetype')}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html,body{width:1080px;height:1350px;overflow:hidden;font-family:'General',system-ui,sans-serif}
body{color:${T.text};background:
  radial-gradient(ellipse 80% 60% at 50% -5%, rgba(18,174,172,0.13) 0%, transparent 60%),
  linear-gradient(170deg, ${T.bg2} 0%, ${T.bg} 60%, #080503 100%);}
.card{position:absolute;inset:0;display:flex;flex-direction:column;padding:72px 76px 56px}
.hd{display:flex;justify-content:space-between;align-items:center;margin-bottom:48px}
.logo{display:flex;align-items:center;gap:14px}
.logo-c{width:40px;height:40px;border-radius:50%;background:${T.accent};display:flex;align-items:center;justify-content:center;font-family:'Cabinet';font-weight:800;font-size:21px;color:#0E0906}
.logo-txt{font-family:'Cabinet';font-weight:800;font-size:24px;letter-spacing:0.06em;color:${T.text}}
.pg{font-family:'General';font-weight:500;font-size:18px;color:${T.muted}}
.ft{display:flex;justify-content:space-between;align-items:center;margin-top:auto;padding-top:24px;border-top:1px solid rgba(255,255,255,0.08)}
.ft-left{font-family:'General';font-weight:500;font-size:16px;color:${T.muted}}
.ft-right{font-family:'General';font-weight:500;font-size:16px;color:${T.muted}}
.tag{display:inline-flex;align-items:center;gap:6px;border-radius:999px;font-family:'General';font-weight:600;font-size:18px}
.pill{border-radius:999px;font-family:'Cabinet';font-weight:800;letter-spacing:0.08em}
.card-box{background:${T.card};border:1px solid ${T.border};border-radius:18px}
.bar-track{background:rgba(255,255,255,0.08);border-radius:999px;overflow:hidden}
</style>
</head><body><div class="card">${body}</div></body></html>`;
}

function header(date: string, slide: number, total: number): string {
  return `<div class="hd">
    <div class="logo">
      <div class="logo-c">C</div>
      <span class="logo-txt">CONVIQT</span>
    </div>
    <span class="pg">${String(slide).padStart(2,"0")} / ${String(total).padStart(2,"0")}</span>
  </div>`;
}

function footer(left: string, right: string): string {
  return `<div class="ft"><span class="ft-left">${left}</span><span class="ft-right">${right}</span></div>`;
}

// ── 7 slide generators ────────────────────────────────────────────────────────

function slide1(c: CouncilResult, q: Quote | null): string {
  const v = c.judge.verdict;
  const color = vc(v);
  const priceStr = q ? `${fmtPrice(q.price)}  <span style="color:${q.changePct != null && q.changePct >= 0 ? T.up : T.down};font-size:22px">${fmtChange(q.changePct)}</span>` : "";
  return html(`
    ${header(fmtDate(c.asOf), 1, 7)}
    <div style="flex:1;display:flex;flex-direction:column;justify-content:center;gap:0">
      <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.12em;color:${T.muted};margin-bottom:24px">AI STOCK RESEARCH</div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:118px;line-height:0.92;letter-spacing:-0.04em;color:${T.text};margin-bottom:16px">${c.ticker}</div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:32px;color:${T.text2};margin-bottom:8px">${c.factSheet.companyName}</div>
      <div style="font-family:'General';font-weight:500;font-size:20px;color:${T.muted};margin-bottom:52px">${c.factSheet.sector}</div>

      <div style="width:72px;height:3px;background:${T.accent};border-radius:2px;margin-bottom:52px"></div>

      <div style="display:flex;align-items:center;gap:24px;margin-bottom:32px">
        <span class="pill" style="padding:12px 28px;background:${vbg(v)};color:${color};font-size:30px">${v}</span>
        <div style="display:flex;flex-direction:column;gap:4px">
          <span style="font-family:'General';font-weight:500;font-size:18px;color:${T.muted};letter-spacing:0.06em">CONVICTION</span>
          <span style="font-family:'Cabinet';font-weight:800;font-size:52px;color:${color};line-height:1">${c.judge.conviction} <span style="font-size:24px;color:${T.muted}">/ 100</span></span>
        </div>
      </div>

      <div style="background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:28px 32px">
        <div style="font-family:'Cabinet';font-weight:700;font-size:26px;color:${T.text};line-height:1.45">"${trunc(c.judge.bottomLine, 110)}"</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:space-between;margin-top:28px">
      <span style="font-family:'General';font-weight:600;font-size:26px;color:${T.text}">${priceStr}</span>
      <span style="font-family:'General';font-weight:500;font-size:18px;color:${T.muted};letter-spacing:0.04em">SWIPE FOR FULL BREAKDOWN →</span>
    </div>
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide2(c: CouncilResult): string {
  // Analyst team: 4 agents in a 2x2 grid
  const agents = c.agents;
  function agentCard(a: AgentOutput): string {
    const color = vc(a.verdict);
    const barW = a.confidence;
    return `<div style="flex:1;background:${T.card};border:1px solid ${T.border};border-radius:16px;padding:28px;display:flex;flex-direction:column;gap:14px">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-family:'General';font-weight:600;font-size:18px;letter-spacing:0.06em;color:${T.muted}">${a.agent.toUpperCase()}</span>
        <span class="pill" style="padding:6px 16px;background:${vbg(a.verdict)};color:${color};font-size:17px">${a.verdict}</span>
      </div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:62px;line-height:1;letter-spacing:-0.02em;color:${color}">${a.confidence}</div>
      <div style="font-family:'General';font-weight:500;font-size:16px;color:${T.muted}">confidence score</div>
      <div class="bar-track" style="height:6px">
        <div style="width:${barW}%;height:100%;background:${color};border-radius:999px"></div>
      </div>
      ${a.flags.length > 0 ? `<div style="background:rgba(255,255,255,0.05);border-radius:8px;padding:8px 12px;font-family:'General';font-weight:500;font-size:15px;color:${T.text2}">${trunc(a.flags[0], 32)}</div>` : ""}
    </div>`;
  }

  const buyN = agents.filter(a => a.verdict === "BUY").length;
  const sellN = agents.filter(a => a.verdict === "SELL").length;
  const consensus = buyN >= 3 ? `${buyN} of 4 analysts say BUY` : sellN >= 3 ? `${sellN} of 4 say SELL` : `Analysts split — mixed signals`;

  return html(`
    ${header(fmtDate(c.asOf), 2, 7)}
    <div style="margin-bottom:36px">
      <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:10px">THE ANALYSTS</div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:52px;line-height:1.08;letter-spacing:-0.02em;color:${T.text}">${consensus}</div>
    </div>
    <div style="display:flex;gap:16px;margin-bottom:16px">
      ${agentCard(agents[0])}${agentCard(agents[1])}
    </div>
    <div style="display:flex;gap:16px;margin-bottom:28px">
      ${agentCard(agents[2])}${agentCard(agents[3])}
    </div>
    ${c.judge.dissents.length > 0
      ? `<div style="background:${T.holdWeak};border:1px solid rgba(201,164,74,0.2);border-radius:12px;padding:16px 22px;font-family:'General';font-weight:500;font-size:18px;color:${T.hold}">⚠ Dissent from ${c.judge.dissents.join(", ")} — read both cases carefully</div>`
      : `<div style="background:${T.accentDim};border:1px solid rgba(18,174,172,0.2);border-radius:12px;padding:16px 22px;font-family:'General';font-weight:500;font-size:18px;color:${T.accent}">✓ All four analysts aligned on direction</div>`
    }
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide3(c: CouncilResult): string {
  // Durability gauge using agent confidences mapped to pillar-style display
  const j = c.judge;
  const color = vc(j.verdict);
  const conv = j.conviction;
  const label = conv >= 75 ? "HIGH CONVICTION" : conv >= 55 ? "MODERATE" : "LOW CONVICTION";
  const gauge = gaugeSVG(conv, color, 340);

  // Map agents to pillar names for the display
  const pillars = [
    { name: "Fundamentals", score: c.agents.find(a => a.agent === "Fundamentals")?.confidence ?? 0 },
    { name: "Technicals",   score: c.agents.find(a => a.agent === "Technicals")?.confidence ?? 0 },
    { name: "Sentiment",    score: c.agents.find(a => a.agent === "Sentiment")?.confidence ?? 0 },
    { name: "Macro",        score: c.agents.find(a => a.agent === "Macro")?.confidence ?? 0 },
  ];

  function pillarRow(name: string, score: number): string {
    const pColor = score >= 70 ? T.up : score >= 50 ? T.hold : T.down;
    return `<div style="margin-bottom:18px">
      <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">
        <span style="font-family:'General';font-weight:600;font-size:20px;color:${T.text}">${name}</span>
        <span style="font-family:'Cabinet';font-weight:800;font-size:26px;color:${pColor}">${score}</span>
      </div>
      <div class="bar-track" style="height:8px">
        <div style="width:${score}%;height:100%;background:${pColor};border-radius:999px;transition:width 0s"></div>
      </div>
    </div>`;
  }

  return html(`
    ${header(fmtDate(c.asOf), 3, 7)}
    <div style="display:flex;gap:40px;align-items:flex-start;margin-bottom:32px">
      <div style="flex:0 0 auto">
        <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:16px">OVERALL CONVICTION</div>
        ${gauge}
        <div style="text-align:center;margin-top:8px">
          <span style="display:inline-flex;align-items:center;gap:8px;background:${vbg(j.verdict)};border-radius:999px;padding:10px 24px">
            <span style="font-family:'General';font-weight:600;font-size:17px;color:${color};letter-spacing:0.05em">${label}</span>
          </span>
        </div>
      </div>
      <div style="flex:1">
        <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:20px">ANALYST SCORES</div>
        ${pillars.map(p => pillarRow(p.name, p.score)).join("")}
      </div>
    </div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:24px 28px">
      <div style="font-family:'General';font-weight:600;font-size:16px;letter-spacing:0.08em;color:${T.muted};margin-bottom:10px">THE INVESTMENT CASE</div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:24px;color:${T.text};line-height:1.45">${trunc(j.investmentCase, 200)}</div>
    </div>
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide4(c: CouncilResult): string {
  const j = c.judge;

  function metricRow(label: string, value: string, signal: string, last = false): string {
    const color = sc(signal);
    const dot = `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:10px;flex-shrink:0"></span>`;
    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:20px 0;${last ? "" : "border-bottom:1px solid rgba(255,255,255,0.07)"}">
      <span style="font-family:'General';font-weight:500;font-size:22px;color:${T.text2}">${label}</span>
      <span style="display:flex;align-items:center;font-family:'General';font-weight:600;font-size:26px;color:${color}">${dot}${value}</span>
    </div>`;
  }

  const metrics = j.keyMetrics.slice(0, 5);

  return html(`
    ${header(fmtDate(c.asOf), 4, 7)}
    <div style="margin-bottom:32px">
      <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:10px">THE DATA</div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:52px;line-height:1.08;letter-spacing:-0.02em;color:${T.text}">Key Signals</div>
    </div>
    <div style="background:${T.card};border:1px solid ${T.border};border-radius:18px;padding:8px 32px;margin-bottom:24px;flex:1">
      ${metrics.map((m, i) => metricRow(m.label, m.value, m.signal, i === metrics.length - 1)).join("")}
    </div>
    <div style="display:flex;gap:14px">
      <div style="flex:1;background:${T.upWeak};border:1px solid rgba(34,201,216,0.15);border-radius:14px;padding:20px 22px">
        <div style="font-family:'General';font-weight:600;font-size:15px;letter-spacing:0.08em;color:${T.up};margin-bottom:8px">BULL SIGNAL</div>
        <div style="font-family:'Cabinet';font-weight:700;font-size:20px;color:${T.text};line-height:1.4">${trunc(j.bullCase, 80)}</div>
      </div>
      <div style="flex:1;background:${T.downWeak};border:1px solid rgba(227,101,91,0.15);border-radius:14px;padding:20px 22px">
        <div style="font-family:'General';font-weight:600;font-size:15px;letter-spacing:0.08em;color:${T.down};margin-bottom:8px">BEAR SIGNAL</div>
        <div style="font-family:'Cabinet';font-weight:700;font-size:20px;color:${T.text};line-height:1.4">${trunc(j.bearCase, 80)}</div>
      </div>
    </div>
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide5(c: CouncilResult, q: Quote | null): string {
  const j = c.judge;
  const v = c.judge.verdict;
  const color = vc(v);
  const price = fmtPrice(q?.price);
  const changePct = q?.changePct ?? null;

  // Simple price context bar — show rough position between 52w levels if available
  const metric52High = j.keyMetrics.find(m => /52.?w(eek)?.?(high|low)/i.test(m.label) && /high/i.test(m.label));
  const metric52Low = j.keyMetrics.find(m => /52.?w(eek)?.?(high|low)/i.test(m.label) && /low/i.test(m.label));

  return html(`
    ${header(fmtDate(c.asOf), 5, 7)}
    <div style="margin-bottom:32px">
      <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:10px">BULL vs BEAR</div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:52px;line-height:1.08;letter-spacing:-0.02em;color:${T.text}">The Full Case</div>
    </div>

    <div style="background:${T.upWeak};border:1px solid rgba(34,201,216,0.18);border-radius:18px;padding:32px;margin-bottom:18px;flex:1">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:10px;height:10px;border-radius:50%;background:${T.up};flex-shrink:0"></div>
        <span style="font-family:'General';font-weight:600;font-size:18px;color:${T.up};letter-spacing:0.08em">BULL CASE</span>
      </div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:26px;color:${T.text};line-height:1.5">${trunc(j.bullCase, 220)}</div>
    </div>

    <div style="background:${T.downWeak};border:1px solid rgba(227,101,91,0.18);border-radius:18px;padding:32px;margin-bottom:18px;flex:1">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px">
        <div style="width:10px;height:10px;border-radius:50%;background:${T.down};flex-shrink:0"></div>
        <span style="font-family:'General';font-weight:600;font-size:18px;color:${T.down};letter-spacing:0.08em">BEAR CASE</span>
      </div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:26px;color:${T.text};line-height:1.5">${trunc(j.bearCase, 220)}</div>
    </div>

    <div style="background:${T.card};border:1px solid ${T.border};border-radius:14px;padding:20px 26px;display:flex;justify-content:space-between;align-items:center">
      <div>
        <div style="font-family:'General';font-weight:500;font-size:16px;color:${T.muted};margin-bottom:4px">CURRENT PRICE</div>
        <div style="font-family:'Cabinet';font-weight:800;font-size:36px;color:${T.text}">${price} <span style="font-size:22px;color:${changePct != null && changePct >= 0 ? T.up : T.down}">${fmtChange(changePct)}</span></div>
      </div>
      <span class="pill" style="padding:14px 28px;background:${vbg(v)};color:${color};font-size:28px">${v}</span>
    </div>
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide6(c: CouncilResult): string {
  const j = c.judge;
  const catalysts = j.catalysts.slice(0, 4);
  const colors = [T.up, T.accent, T.hold, T.down];

  function catalystItem(text: string, i: number): string {
    const color = colors[i];
    return `<div style="display:flex;align-items:flex-start;gap:20px;${i < catalysts.length - 1 ? "margin-bottom:22px" : ""}">
      <div style="width:32px;height:32px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:2px;font-family:'Cabinet';font-weight:800;font-size:16px;color:#0E0906">${i + 1}</div>
      <div style="flex:1;font-family:'General';font-weight:500;font-size:22px;color:${T.text};line-height:1.5">${trunc(text, 90)}</div>
    </div>`;
  }

  return html(`
    ${header(fmtDate(c.asOf), 6, 7)}
    <div style="margin-bottom:36px">
      <div style="font-family:'General';font-weight:600;font-size:20px;letter-spacing:0.1em;color:${T.muted};margin-bottom:10px">WHAT TO WATCH</div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:52px;line-height:1.08;letter-spacing:-0.02em;color:${T.text}">The Road Ahead</div>
    </div>

    <div style="background:${T.card};border:1px solid ${T.border};border-radius:18px;padding:32px;margin-bottom:24px">
      ${catalysts.map((c, i) => catalystItem(c, i)).join("")}
    </div>

    <div style="background:${T.accentDim};border:1px solid rgba(18,174,172,0.18);border-radius:14px;padding:24px 28px;margin-bottom:20px">
      <div style="font-family:'General';font-weight:600;font-size:16px;letter-spacing:0.08em;color:${T.accent};margin-bottom:10px">LIKELIEST SCENARIO</div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:24px;color:${T.text};line-height:1.45">${trunc(j.investmentCase, 160)}</div>
    </div>
    ${footer("@conviqt", "research, not advice")}
  `);
}

function slide7(c: CouncilResult): string {
  const v = c.judge.verdict;
  const color = vc(v);
  return html(`
    ${header(fmtDate(c.asOf), 7, 7)}
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:0">
      <div style="width:80px;height:80px;border-radius:50%;background:${T.accent};display:flex;align-items:center;justify-content:center;margin-bottom:28px">
        <span style="font-family:'Cabinet';font-weight:800;font-size:44px;color:#0E0906">C</span>
      </div>
      <div style="font-family:'Cabinet';font-weight:800;font-size:52px;letter-spacing:0.06em;color:${T.text};margin-bottom:20px">CONVIQT</div>
      <div style="width:60px;height:3px;background:${T.accent};border-radius:2px;margin-bottom:36px"></div>
      <div style="font-family:'Cabinet';font-weight:700;font-size:42px;line-height:1.25;color:${T.text};max-width:680px;margin-bottom:48px">Get AI analysis like this for any stock — free to start.</div>
      <div style="background:${T.accent};border-radius:999px;padding:20px 52px;font-family:'Cabinet';font-weight:800;font-size:30px;color:#0E0906;margin-bottom:28px;letter-spacing:-0.01em">conviqt.com</div>
      <div style="font-family:'General';font-weight:500;font-size:22px;color:${T.muted}">Research tool · Not financial advice</div>
    </div>
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding-top:28px;border-top:1px solid rgba(255,255,255,0.08)">
      <div style="display:flex;gap:16px">
        <span class="pill" style="padding:8px 20px;background:${vbg(v)};color:${color};font-size:20px">${c.ticker} · ${v}</span>
        <span class="pill" style="padding:8px 20px;background:${T.accentDim};color:${T.accent};font-size:20px">Conviction ${c.judge.conviction}/100</span>
      </div>
      <span style="font-family:'General';font-weight:500;font-size:16px;color:${T.muted}">@conviqt</span>
    </div>
  `);
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
  const raw = process.argv[2];
  if (!raw) { console.error("Usage: npm run card -- <TICKER>"); process.exit(1); }
  const ticker = raw.toUpperCase();

  console.log(`\n▶  Conviqt card generator — ${ticker}`);
  console.log("   1/3  Running Council pipeline (~60s)…");

  let council: CouncilResult;
  let q: Quote | null = null;
  try {
    [council, q] = await Promise.all([
      runCouncil(ticker, {
        onEvent: (e) => {
          if (e.kind === "specialist_done") process.stdout.write(`         ✓ ${e.agent.agent}\n`);
        },
      }),
      quote(ticker),
    ]);
  } catch (err) {
    console.error("Pipeline error:", err);
    process.exit(1);
  }

  const { verdict, conviction } = council.judge;
  console.log(`   2/3  ${verdict} · Conviction ${conviction} — generating HTML…`);

  const slides = [
    { name: "01-cover",    html: slide1(council, q) },
    { name: "02-analysts", html: slide2(council) },
    { name: "03-verdict",  html: slide3(council) },
    { name: "04-signals",  html: slide4(council) },
    { name: "05-cases",    html: slide5(council, q) },
    { name: "06-ahead",    html: slide6(council) },
    { name: "07-cta",      html: slide7(council) },
  ];

  const date = new Date().toISOString().slice(0, 10);
  const outDir = `/Users/vanshagarwal/Desktop/Conviqt/conviqt-instagram/cards/${ticker}-${date}`;
  fs.mkdirSync(outDir, { recursive: true });

  console.log("   3/3  Screenshotting with Chrome…");

  const browser = await chromium.launch({ channel: "chrome" });
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1080, height: 1350 });

  for (const slide of slides) {
    await page.setContent(slide.html, { waitUntil: "networkidle" });
    // Wait for fonts to load
    await page.waitForTimeout(400);
    const p = path.join(outDir, `${slide.name}.png`);
    await page.screenshot({ path: p, type: "png" });
    console.log(`      ✓ ${slide.name}.png`);
  }

  await browser.close();

  console.log(`\n✅  7 cards → ${outDir}`);
  const { execSync } = await import("child_process");
  execSync(`open "${outDir}"`);
}

main().catch((err) => { console.error(err); process.exit(1); });
