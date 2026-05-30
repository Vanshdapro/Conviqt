"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// ── Constants ─────────────────────────────────────────────────────────────────
const BG = "#020810";
const TOTAL_H = "1700vh";

// Scroll phase boundaries (0→1)
const LAND_END  = 0.040;
const BEAM_END  = 0.155;
const AUR_END   = 0.265;
const HOLE_END  = 0.385;
const BUILD_END = 0.505;
const HOLD_END  = 0.625;
const LED_END   = 0.740;
const CABL_END  = 0.855;

const FINAL_ROT_Y = Math.PI * 4.6;
const FINAL_SCALE = 1.5;

// ── Math ──────────────────────────────────────────────────────────────────────
const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const eOut  = (t: number) => 1 - (1 - t) ** 3;
const eIn   = (t: number) => t * t * t;
const lerp  = (a: number, b: number, t: number) => a + (b - a) * t;

function sr(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// ── Sphere (Fibonacci) ────────────────────────────────────────────────────────
type SDot = { x: number; y: number; z: number };
function buildSphere(N: number): SDot[] {
  const phi = Math.PI * (Math.sqrt(5) - 1);
  return Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const t = phi * i;
    return { x: Math.cos(t) * r, y, z: Math.sin(t) * r };
  });
}
const SPHERE = buildSphere(1200);

// ── Stars ─────────────────────────────────────────────────────────────────────
type Star = { x: number; y: number; r: number; a: number; phase: number };
function buildStars(W: number, H: number): Star[] {
  return Array.from({ length: 340 }, (_, i) => ({
    x:     sr(i * 7 + 1) * W,
    y:     sr(i * 7 + 2) * H,
    r:     sr(i * 7 + 3) * 1.6 + 0.12,
    a:     sr(i * 7 + 4) * 0.55 + 0.08,
    phase: sr(i * 7 + 5) * Math.PI * 2,
  }));
}

// ── Galaxy beam particles ─────────────────────────────────────────────────────
type GParticle = {
  angle: number; height: number; dist: number;
  size: number; speed: number; hue: number;
};
function buildGalaxy(N = 1500): GParticle[] {
  return Array.from({ length: N }, (_, i) => ({
    angle:  sr(i * 3 + 0) * Math.PI * 2,
    height: (sr(i * 3 + 1) - 0.5) * 2,
    dist:   sr(i) ** 1.6,
    size:   sr(i * 3 + 2) * 2.4 + 0.3,
    speed:  sr(i * 3 + 3) * 0.4 + 0.1,
    hue:    lerp(185, 255, sr(i * 3 + 4)),
  }));
}
const GALAXY = buildGalaxy();

// ── Black-hole stream particles ───────────────────────────────────────────────
type HParticle = { side: 0 | 1; t: number; spread: number; speed: number };
function buildHole(N = 2400): HParticle[] {
  return Array.from({ length: N }, (_, i) => ({
    side:   (i < N / 2 ? 0 : 1) as 0 | 1,
    t:      sr(i * 3),
    spread: (sr(i * 3 + 1) - 0.5) * 2,
    speed:  sr(i * 3 + 2) * 0.4 + 0.3,
  }));
}
const HOLE_P = buildHole();

// ── Project sphere ────────────────────────────────────────────────────────────
type ProjDot = { px: number; py: number; depth: number; hue: number; sat: number; lit: number };
function projectSphere(
  W: number, H: number, rotY: number, scale: number, buildFrac = 1,
): ProjDot[] {
  const cx = W / 2, cy = H / 2;
  const R = Math.min(W, H) * 0.36 * scale;
  const FOV = 900;
  const cos = Math.cos(rotY), sin = Math.sin(rotY);
  const out: ProjDot[] = [];
  for (const d of SPHERE) {
    if (Math.abs(d.y) > buildFrac + 0.02) continue;
    const rx = d.x * cos - d.z * sin;
    const rz = d.x * sin + d.z * cos;
    const s  = FOV / (FOV + rz * R * 0.28);
    const ct  = (rx + 1) / 2;
    const hue = ct < 0.5 ? lerp(268, 322, ct * 2) : lerp(322, 192, (ct - 0.5) * 2);
    const depth = (rz + 1) / 2;
    out.push({ px: cx + rx * R * s, py: cy + d.y * R * s, depth, hue, sat: 88 + depth * 10, lit: 52 + depth * 36 });
  }
  return out;
}

function buildEdges(dots: ProjDot[], W: number, H: number): [number, number][] {
  const THRESH = 160, MAX_N = 4, margin = 100;
  const vis: { i: number; px: number; py: number }[] = [];
  for (let i = 0; i < dots.length; i++) {
    const { px, py } = dots[i];
    if (px > -margin && px < W + margin && py > -margin && py < H + margin)
      vis.push({ i, px, py });
  }
  const edges: [number, number][] = [];
  for (let a = 0; a < vis.length; a++) {
    const A = vis[a];
    const near: { i: number; d: number }[] = [];
    for (let b = a + 1; b < vis.length; b++) {
      const B = vis[b];
      const d = Math.hypot(B.px - A.px, B.py - A.py);
      if (d < THRESH) near.push({ i: B.i, d });
    }
    near.sort((x, y) => x.d - y.d);
    for (const { i } of near.slice(0, MAX_N)) edges.push([A.i, i]);
  }
  return edges;
}

// ── Wordmark dot type (built at runtime via offscreen canvas) ─────────────────
type CDot = { x: number; y: number };

// ── Agent label definitions ───────────────────────────────────────────────────
interface LabelDef {
  lines: string[]; sub: string; tag: string;
  side: "left" | "right"; pStart: number; pPeak: number; pEnd: number; color: string;
}
const LABELS: LabelDef[] = [
  { lines: ["Sweep Agent"], sub: "Web search · fact extraction", tag: "14 sources verified",
    side: "left",  pStart: 0.515, pPeak: 0.555, pEnd: 0.605, color: "rgba(110,182,255,1)" },
  { lines: ["Fundamentals", "Specialist"], sub: "Revenue · margins · debt/equity", tag: "BUY — 87% confidence",
    side: "right", pStart: 0.548, pPeak: 0.588, pEnd: 0.638, color: "rgba(52,211,153,1)" },
  { lines: ["Sentiment &", "Technicals"], sub: "RSI · analyst coverage · MACD", tag: "HOLD — 61% confidence",
    side: "left",  pStart: 0.578, pPeak: 0.618, pEnd: 0.668, color: "rgba(251,191,36,1)" },
  { lines: ["Judge Agent"], sub: "Synthesises all 5 verdicts", tag: "Final: BUY · Disagree: Low",
    side: "right", pStart: 0.608, pPeak: 0.648, pEnd: 0.698, color: "rgba(167,139,250,1)" },
];

// ── Feature panels ────────────────────────────────────────────────────────────
interface PanelDef { start: number; peak: number; end: number; label: string; head: string[]; body: string; }
const PANELS: PanelDef[] = [
  { start: 0.09, peak: 0.12, end: 0.17, label: "Citation-First",
    head: ["Every claim.", "One source URL."],
    body: "No hallucinations. No black-box outputs. Every number Conviqt surfaces is traced to a live web source you can click and verify — no exceptions." },
  { start: 0.18, peak: 0.21, end: 0.26, label: "The Council Pipeline",
    head: ["Five specialists.", "Parallel debate."],
    body: "Fundamentals, Technicals, Sentiment, and Macro run simultaneously on live data. A Judge synthesises all four into one final verdict with a conviction score." },
  { start: 0.28, peak: 0.31, end: 0.37, label: "Radical Transparency",
    head: ["Disagreement", "exposed."],
    body: "When agents fracture, you see it. A disagreement score shows exactly how divided the council is — so you can weight the verdict against your own thesis." },
];

// ── Sidebar items ─────────────────────────────────────────────────────────────
const SIDEBAR = [
  { label: "Research",     href: "/chat",        icon: "◈" },
  { label: "Learn",        href: "/learn",       icon: "◓" },
  { label: "Alpha Tracker",href: "/alpha",       icon: "◇" },
  { label: "Pricing",      href: "/pricing",     icon: "◑" },
  { label: "Methodology",  href: "/methodology", icon: "◎" },
];

// ─── Component ────────────────────────────────────────────────────────────────
export default function IntroAnimation() {
  const sectionRef = useRef<HTMLDivElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const landingRef = useRef<HTMLDivElement>(null);
  const rafRef     = useRef<number>(0);

  const [cookieVisible, setCookieVisible] = useState(true);
  const [scrollP,   setScrollP]   = useState(0);
  const [hoverNav,  setHoverNav]  = useState<string | null>(null);

  const expandedRef      = useRef<ProjDot[]>([]);
  const edgesRef         = useRef<[number, number][]>([]);
  const cDotsRef         = useRef<CDot[]>([]);
  const wordmarkEdgesRef = useRef<[number, number][]>([]);
  const starsRef         = useRef<Star[]>([]);
  const mousePosRef      = useRef({ x: -1, y: -1 });

  const sidebarOn = scrollP > 0.50;

  useEffect(() => {
    const section = sectionRef.current!;
    const canvas  = canvasRef.current!;
    const landing = landingRef.current!;
    const ctx     = canvas.getContext("2d")!;
    const t0      = performance.now();

    // ── Wordmark helpers (client-only, inside useEffect) ─────────────────────
    function buildWordmarkDots(W: number, H: number, step: number): CDot[] {
      const oc = document.createElement("canvas");
      oc.width = W; oc.height = H;
      const ox = oc.getContext("2d")!;
      const fSize = Math.min(W / 6.8, H * 0.58);
      ox.font = `300 ${fSize}px Georgia, serif`;
      ox.textAlign = "center"; ox.textBaseline = "middle";
      ox.fillStyle = "#fff";
      ox.fillText("CONVIQT", W / 2, H / 2);
      const data = ox.getImageData(0, 0, W, H).data;
      const dots: CDot[] = [];
      for (let y = 0; y < H; y += step) {
        for (let x = 0; x < W; x += step) {
          if (data[(y * W + x) * 4 + 3] > 80) dots.push({ x, y });
        }
      }
      return dots;
    }

    function buildWordmarkEdges(dots: CDot[], thresh: number): [number, number][] {
      const edges: [number, number][] = [];
      for (let i = 0; i < dots.length; i++) {
        let cnt = 0;
        for (let j = i + 1; j < dots.length && cnt < 5; j++) {
          const d = Math.hypot(dots[j].x - dots[i].x, dots[j].y - dots[i].y);
          if (d < thresh) { edges.push([i, j]); cnt++; }
        }
      }
      return edges;
    }

    // ── Resize ──────────────────────────────────────────────────────────────
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.style.width  = innerWidth  + "px";
      canvas.style.height = innerHeight + "px";
      canvas.width  = innerWidth  * dpr;
      canvas.height = innerHeight * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      expandedRef.current = projectSphere(innerWidth, innerHeight, FINAL_ROT_Y, FINAL_SCALE);
      edgesRef.current    = buildEdges(expandedRef.current, innerWidth, innerHeight);
      const wStep = Math.max(12, Math.round(innerWidth / 100));
      cDotsRef.current         = buildWordmarkDots(innerWidth, innerHeight, wStep);
      wordmarkEdgesRef.current = buildWordmarkEdges(cDotsRef.current, wStep * 2.2);
      starsRef.current    = buildStars(innerWidth, innerHeight);
    };
    resize();
    addEventListener("resize", resize);

    // ── Stars ────────────────────────────────────────────────────────────────
    function drawStars(alpha: number, ms: number) {
      const { x: mx, y: my } = mousePosRef.current;
      for (const s of starsRef.current) {
        const tw = 0.65 + 0.35 * Math.sin(ms * 0.00055 + s.phase);
        let boost = 1;
        if (mx >= 0) {
          const d = Math.hypot(s.x - mx, s.y - my);
          boost = 1 + Math.max(0, 1 - d / 200) * 2.8;
        }
        const r = s.r * Math.min(boost, 3.0);
        const a = Math.min(1, s.a * tw * alpha * Math.min(boost, 2.5));
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(175,210,255,${a.toFixed(3)})`;
        ctx.fill();
      }
    }

    // ── Galaxy beam ──────────────────────────────────────────────────────────
    function drawGalaxyBeam(t: number, ms: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const cx = W / 2, cy = H / 2;

      // Full-screen radial glow
      const rg = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(W, H) * 0.75);
      rg.addColorStop(0,   `rgba(30,100,240,${(t * 0.22).toFixed(3)})`);
      rg.addColorStop(0.45, `rgba(15,60,200,${(t * 0.11).toFixed(3)})`);
      rg.addColorStop(1,   "rgba(0,0,0,0)");
      ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);

      // Full-screen vertical nebula glow
      const vg = ctx.createLinearGradient(cx, 0, cx, H);
      vg.addColorStop(0,   "rgba(80,180,255,0)");
      vg.addColorStop(0.18, `rgba(100,190,255,${(t * 0.18).toFixed(3)})`);
      vg.addColorStop(0.5, `rgba(200,240,255,${(t * 0.32).toFixed(3)})`);
      vg.addColorStop(0.82, `rgba(100,190,255,${(t * 0.18).toFixed(3)})`);
      vg.addColorStop(1,   "rgba(80,180,255,0)");
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, W, H);

      // Particles — spread to full screen
      const rot = ms * 0.00014;
      for (const p of GALAXY) {
        const angle  = p.angle + rot * p.speed;
        const spreadX = (W * 0.5) * (0.04 + p.dist * 0.96) * t;
        const spreadY = (H * 0.5) * (0.08 + p.dist * 0.92) * t;
        const px = cx + Math.cos(angle) * spreadX;
        const py = cy + p.height * spreadY;
        const a  = (0.12 + (1 - p.dist) * 0.65) * t;
        if (a < 0.02) continue;
        const sz = p.size * t;
        if (p.size > 2.0) {
          const g = ctx.createRadialGradient(px, py, 0, px, py, sz * 4.5);
          g.addColorStop(0, `hsla(${p.hue},95%,80%,${(a * 0.48).toFixed(2)})`);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px, py, sz * 4.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, sz, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${p.hue},92%,86%,${a.toFixed(3)})`;
        ctx.fill();
      }
    }

    // ── Aurora horizon ────────────────────────────────────────────────────────
    function drawAurora(t: number, ms: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const hy = H * 0.70;

      // Sky gradient
      const sg = ctx.createLinearGradient(0, 0, 0, H);
      sg.addColorStop(0,   "rgba(0,0,0,0)");
      sg.addColorStop(0.5, `rgba(6,12,42,${(t * 0.65).toFixed(3)})`);
      sg.addColorStop(1,   `rgba(4,8,32,${(t * 0.95).toFixed(3)})`);
      ctx.fillStyle = sg; ctx.fillRect(0, 0, W, H);

      // Ground warmth
      const gg = ctx.createLinearGradient(0, hy, 0, H);
      gg.addColorStop(0, `rgba(255,110,35,${(t * 0.18).toFixed(3)})`);
      gg.addColorStop(1, `rgba(160,55,15,${(t * 0.09).toFixed(3)})`);
      ctx.fillStyle = gg; ctx.fillRect(0, hy, W, H - hy);

      // Aurora waves
      type WDef = { h: number; s: number; l: number; amp: number; freq: number };
      const waves: WDef[] = [
        { h: 200, s: 95, l: 65, amp: H * 0.13, freq: 0.0030 },
        { h: 175, s: 88, l: 60, amp: H * 0.09, freq: 0.0042 },
        { h:  32, s: 100, l: 65, amp: H * 0.07, freq: 0.0055 },
      ];
      for (let wi = 0; wi < waves.length; wi++) {
        const wc = waves[wi];
        const spd = ms * 0.00022 + wi * 0.9;
        ctx.beginPath();
        for (let x = 0; x <= W; x += 4) {
          const w1 = Math.sin(x * wc.freq + spd) * wc.amp * t;
          const w2 = Math.sin(x * wc.freq * 1.65 + spd * 0.55) * wc.amp * 0.38 * t;
          const y = hy + w1 + w2;
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath();
        const wg = ctx.createLinearGradient(0, hy - wc.amp, 0, hy + wc.amp);
        wg.addColorStop(0, `hsla(${wc.h},${wc.s}%,${wc.l}%,0)`);
        wg.addColorStop(0.4, `hsla(${wc.h},${wc.s}%,${wc.l}%,${(t * 0.24 * (1 - wi * 0.18)).toFixed(3)})`);
        wg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = wg; ctx.fill();
      }

      // Horizon glow line
      const hg = ctx.createLinearGradient(0, 0, W, 0);
      hg.addColorStop(0,    "rgba(255,130,50,0)");
      hg.addColorStop(0.15, `rgba(255,160,75,${(t * 0.58).toFixed(3)})`);
      hg.addColorStop(0.50, `rgba(90,195,255,${(t * 0.92).toFixed(3)})`);
      hg.addColorStop(0.85, `rgba(255,160,75,${(t * 0.58).toFixed(3)})`);
      hg.addColorStop(1,    "rgba(255,130,50,0)");
      ctx.strokeStyle = hg; ctx.lineWidth = 1.5 * t;
      ctx.beginPath();
      for (let x = 0; x <= W; x += 2) {
        const w = Math.sin(x * 0.0038 + ms * 0.00028) * H * 0.016 * t;
        const y = hy + w;
        if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }

    // ── Black hole ────────────────────────────────────────────────────────────
    function drawBlackHole(t: number, ms: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.21 * t;

      // Outer glow rings
      const glows: [number, number, number, number, number][] = [
        [R * 4.6, 25, 55, 155, 0.055 * t],
        [R * 3.1, 18, 38, 140, 0.090 * t],
        [R * 2.1, 10, 22, 125, 0.130 * t],
        [R * 1.35, 4, 12,  105, 0.175 * t],
      ];
      for (const [r, cr, cg, cb, ca] of glows) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${ca.toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // Streaming particles
      const spd = ms * 0.00033;
      for (const p of HOLE_P) {
        const ph = (p.t + spd * p.speed) % 1;
        const isLeft = p.side === 0;
        const x0  = isLeft ? -W * 0.08 : W * 1.08;
        const x1  = cx + (isLeft ? -R * 0.55 : R * 0.55);
        const cpX = (x0 + x1) / 2;
        const cpY = cy + p.spread * H * 0.32;

        const bx = lerp(lerp(x0, cpX, ph), lerp(cpX, x1, ph), ph);
        const by = lerp(lerp(cy + p.spread * H * 0.46, cpY, ph), lerp(cpY, cy, ph), ph);

        if (Math.hypot(bx - cx, by - cy) < R * 0.82) continue;

        const a = (ph < 0.7 ? ph / 0.7 : 1 - (ph - 0.7) / 0.3) * 0.75 * t;
        const hue = isLeft ? lerp(210, 250, ph) : lerp(28, 12, ph);

        ctx.beginPath(); ctx.arc(bx, by, 1.2 + (1 - ph) * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},90%,75%,${a.toFixed(3)})`; ctx.fill();
      }

      // Core void
      const cg = ctx.createRadialGradient(cx, cy, 0, cx, cy, R * 1.18);
      cg.addColorStop(0,    "#000000");
      cg.addColorStop(0.72, "#010308");
      cg.addColorStop(0.90, `rgba(4,14,58,${t.toFixed(3)})`);
      cg.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = cg;
      ctx.beginPath(); ctx.arc(cx, cy, R * 1.18, 0, Math.PI * 2); ctx.fill();

      // Accretion disk
      const ringAng = ms * 0.00042;
      for (let i = 0; i < 120; i++) {
        const ang = (i / 120) * Math.PI * 2 + ringAng;
        const rx  = cx + R * 1.06 * Math.cos(ang);
        const ry  = cy + R * 0.27 * Math.sin(ang);
        const b   = 0.5 + 0.5 * Math.sin(ang * 3 + ms * 0.002);
        const hue = i < 60 ? lerp(220, 248, i / 60) : lerp(28, 46, (i - 60) / 60);
        ctx.beginPath(); ctx.arc(rx, ry, 1.4 + b, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},95%,80%,${(b * 0.72 * t).toFixed(3)})`; ctx.fill();
      }
    }

    // ── Globe ─────────────────────────────────────────────────────────────────
    function drawGlobe(rotY: number, buildFrac: number, scale: number, alpha: number, ms: number) {
      const W = innerWidth, H = innerHeight;
      const cx = W / 2, cy = H / 2;
      const R = Math.min(W, H) * 0.36 * scale;
      const FOV = 900;
      const cos = Math.cos(rotY), sin = Math.sin(rotY);
      const pulse = 1 + 0.065 * Math.sin(ms * 0.00075);
      const p = pulse;

      // Bloom layers
      const bloomLayers: [number, number, number, number, number][] = [
        [R * 3.8 * p, 70,  15, 180, 0.055],
        [R * 3.0 * p, 100, 20, 200, 0.075],
        [R * 2.2 * p, 140, 25, 215, 0.100],
        [R * 1.7 * p, 165, 30, 225, 0.130],
        [R * 1.3 * p, 145, 65, 245, 0.160],
        [R * 1.0 * p, 105, 125, 255, 0.200],
        [R * 0.7 * p, 145, 190, 255, 0.220],
        [R * 0.42 * p, 205, 225, 255, 0.185],
      ];
      for (const [r, cr, cg, cb, ca] of bloomLayers) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${(ca * alpha).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      }

      // Latitude wireframe
      for (let lat = -75; lat <= 75; lat += 15) {
        const latRad = lat * Math.PI / 180;
        const sinL = Math.sin(latRad), cosL = Math.cos(latRad);
        const N = 80;
        ctx.beginPath(); let vis = false;
        for (let i = 0; i <= N; i++) {
          const lon = (i / N) * Math.PI * 2;
          const dx = Math.sin(lon) * cosL, dz = Math.cos(lon) * cosL;
          const rx = dx * cos - dz * sin, rz = dx * sin + dz * cos;
          if (rz < -0.25) { vis = false; continue; }
          const s = FOV / (FOV + rz * R * 0.28);
          const px = cx + rx * R * s, py = cy + sinL * R * s;
          if (!vis) { ctx.moveTo(px, py); vis = true; } else ctx.lineTo(px, py);
        }
        ctx.strokeStyle = `hsla(${220 + (lat / 90) * 45},80%,72%,${(0.22 * alpha).toFixed(3)})`;
        ctx.lineWidth = 0.6; ctx.stroke();
      }

      // Dots
      const proj = projectSphere(W, H, rotY, scale, buildFrac);
      proj.sort((a, b) => a.depth - b.depth);
      for (const { px, py, depth, hue, sat, lit } of proj) {
        if (px < -50 || px > W + 50 || py < -50 || py > H + 50) continue;
        const a    = clamp((0.10 + depth * 0.90) * alpha);
        const size = clamp(0.4 + depth * 3.2, 0.3, 6.0) * (R / 220) * pulse;
        if (depth > 0.62) {
          const gr = size * (depth > 0.7 ? 8.5 : 5.5);
          const g  = ctx.createRadialGradient(px, py, 0, px, py, gr);
          g.addColorStop(0, `hsla(${hue},${sat}%,${lit}%,${(a * 0.60).toFixed(3)})`);
          g.addColorStop(1, `hsla(${hue},${sat}%,${lit}%,0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(px, py, gr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, clamp(size, 0.3), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},${sat}%,${Math.min(95, lit + 8)}%,${a.toFixed(3)})`; ctx.fill();
      }
    }

    // ── Constellation ─────────────────────────────────────────────────────────
    function drawConstellation(alpha: number) {
      if (alpha < 0.005) return;
      const dots = expandedRef.current, edges = edgesRef.current;
      ctx.lineWidth = 0.8;
      for (const [i, j] of edges) {
        const a = dots[i], b = dots[j];
        if (!a || !b) continue;
        const dist = Math.hypot(b.px - a.px, b.py - a.py);
        const la   = alpha * (1 - dist / 160) * 0.65;
        if (la < 0.004) continue;
        const grad = ctx.createLinearGradient(a.px, a.py, b.px, b.py);
        grad.addColorStop(0, `hsla(${a.hue},90%,75%,${la.toFixed(3)})`);
        grad.addColorStop(1, `hsla(${b.hue},90%,75%,${la.toFixed(3)})`);
        ctx.strokeStyle = grad;
        ctx.beginPath(); ctx.moveTo(a.px, a.py); ctx.lineTo(b.px, b.py); ctx.stroke();
      }
    }

    // ── Agent labels ──────────────────────────────────────────────────────────
    function drawLabels(p: number, ms: number) {
      const W = innerWidth, H = innerHeight;
      if (W < 700) return;
      const R  = Math.min(W, H) * 0.36;
      const cx = W / 2, cy = H / 2;

      for (const lbl of LABELS) {
        const { lines, sub, tag, side, pStart, pPeak, pEnd, color } = lbl;
        if (p < pStart || p > pEnd) continue;

        const isIn = p <= pPeak;
        let lt = isIn
          ? (p - pStart) / (pPeak - pStart)
          : 1 - (p - pPeak) / (pEnd - pPeak);
        lt = clamp(eOut(lt));

        const fsz    = Math.max(16, Math.min(26, W * 0.018));
        const subFsz = Math.max(12, Math.min(15, W * 0.011));
        const lineH  = fsz * 1.85;
        const totalH = lines.length * lineH + subFsz * 3.5;
        const startY = cy - totalH / 2;

        const slideDir = side === "left" ? -1 : 1;
        const slideOff = isIn ? slideDir * (1 - eOut(lt)) * W * 0.06 : 0;
        const baseX    = side === "left" ? W * 0.065 : W * 0.935;
        const renderX  = baseX + slideOff;
        const dissolveT = !isIn ? 1 - lt : 0;

        ctx.save();
        ctx.textBaseline = "middle";
        ctx.textAlign    = side === "left" ? "left" : "right";

        ctx.font = `600 ${fsz}px Georgia,serif`;
        let maxW = 0;
        for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
        const cardW = Math.max(240, maxW + 56);
        const cardH = totalH + 52;
        const cardX = side === "left" ? renderX - 18 : renderX - cardW + 18;
        const cardY = startY - 22;

        ctx.globalAlpha = lt * 0.96;
        ctx.beginPath();
        (ctx as CanvasRenderingContext2D & { roundRect(...a: unknown[]): void })
          .roundRect(cardX, cardY, cardW, cardH, 16);
        ctx.fillStyle = "rgba(2,6,18,0.92)"; ctx.fill();
        ctx.strokeStyle = color.replace("1)", "0.55)"); ctx.lineWidth = 1.2; ctx.stroke();

        const sh = ctx.createLinearGradient(cardX, cardY, cardX + cardW, cardY);
        sh.addColorStop(0,   color.replace("1)", "0)"));
        sh.addColorStop(0.4, color.replace("1)", "0.80)"));
        sh.addColorStop(0.6, color.replace("1)", "0.80)"));
        sh.addColorStop(1,   color.replace("1)", "0)"));
        ctx.strokeStyle = sh; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(cardX + 14, cardY + 0.75);
        ctx.lineTo(cardX + cardW - 14, cardY + 0.75);
        ctx.stroke();
        ctx.globalAlpha = 1;

        if (dissolveT < 0.50) {
          const textAlpha = lt * (1 - dissolveT / 0.5);
          const lineAlpha = clamp(lt / 0.4 - 0.2) * (1 - dissolveT * 2.2);

          if (lineAlpha > 0.01) {
            const labelEdge = side === "left" ? renderX + maxW + 20 : renderX - maxW - 20;
            const globeEdge = side === "left" ? cx - R * 0.90 : cx + R * 0.90;
            ctx.globalAlpha = lineAlpha * 0.38;
            ctx.strokeStyle = color; ctx.lineWidth = 0.9;
            ctx.setLineDash([3, 10]);
            ctx.beginPath(); ctx.moveTo(labelEdge, cy); ctx.lineTo(globeEdge, cy); ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
            const pT  = (ms / 1400) % 1;
            const ppx = labelEdge + (globeEdge - labelEdge) * pT;
            const ppg = ctx.createRadialGradient(ppx, cy, 0, ppx, cy, 7);
            ppg.addColorStop(0, color.replace("1)", "0.95)"));
            ppg.addColorStop(1, color.replace("1)", "0)"));
            ctx.fillStyle = ppg; ctx.beginPath(); ctx.arc(ppx, cy, 7, 0, Math.PI * 2); ctx.fill();
          }

          ctx.globalAlpha = textAlpha;
          ctx.font      = `600 ${fsz}px Georgia,serif`;
          ctx.shadowColor = color.replace("1)", "0.75)"); ctx.shadowBlur = 10;
          ctx.fillStyle = "rgba(255,255,255,1)";
          for (let li = 0; li < lines.length; li++)
            ctx.fillText(lines[li], renderX, startY + li * lineH + lineH / 2);
          ctx.shadowBlur = 0;
          ctx.font = `500 ${subFsz}px Georgia,serif`;
          ctx.fillStyle = "rgba(175,210,245,1)";
          ctx.fillText(sub, renderX, startY + lines.length * lineH + subFsz * 1.1);
          ctx.font = `600 ${Math.max(10, subFsz - 1)}px -apple-system,sans-serif`;
          ctx.fillStyle = color.replace("1)", "0.95)");
          ctx.fillText(tag, renderX, startY + lines.length * lineH + subFsz * 2.7);
          ctx.globalAlpha = 1;
        } else {
          // Particle dissolve toward globe
          const dT = (dissolveT - 0.50) / 0.50;
          ctx.font = `300 ${fsz}px Georgia,serif`;
          for (let li = 0; li < lines.length; li++) {
            const line = lines[li];
            const y    = startY + li * lineH + lineH / 2;
            const tw   = ctx.measureText(line).width;
            const lx   = side === "left" ? renderX : renderX - tw;
            const N    = Math.max(50, line.length * 7);
            for (let i = 0; i < N; i++) {
              const seed  = li * 13000 + i;
              const rx0   = lx + sr(seed) * tw;
              const ry0   = y + (sr(seed + 100) - 0.5) * lineH;
              const angle = Math.atan2(ry0 - cy, rx0 - cx) + (sr(seed + 200) - 0.5) * 1.2;
              const tR    = R * (0.65 + sr(seed + 300) * 0.48);
              const rx1   = cx + Math.cos(angle) * tR;
              const ry1   = cy + Math.sin(angle) * tR;
              const tt    = eOut(Math.min(1, dT * 1.7 + sr(seed + 400) * 0.30));
              const ppx   = rx0 + (rx1 - rx0) * tt;
              const ppy   = ry0 + (ry1 - ry0) * tt;
              const pa    = Math.max(0, (1 - dT * 1.2) * (0.35 + sr(seed + 500) * 0.65));
              if (pa < 0.01) continue;
              const hueMap: Record<string, number> = {
                "rgba(110,182,255,1)": 213, "rgba(52,211,153,1)": 161,
                "rgba(251,191,36,1)":  43,  "rgba(167,139,250,1)": 263,
              };
              const pH   = (hueMap[color] ?? 213) + (sr(seed + 600) - 0.5) * 28;
              const dotR = 0.5 + sr(seed + 700) * 2.2;
              if (dotR > 1.2) {
                const dg = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, dotR * 5);
                dg.addColorStop(0, `hsla(${pH},90%,80%,${(pa * 0.46).toFixed(3)})`);
                dg.addColorStop(1, `hsla(${pH},90%,80%,0)`);
                ctx.fillStyle = dg; ctx.beginPath(); ctx.arc(ppx, ppy, dotR * 5, 0, Math.PI * 2); ctx.fill();
              }
              ctx.beginPath(); ctx.arc(ppx, ppy, dotR, 0, Math.PI * 2);
              ctx.fillStyle = `hsla(${pH},88%,85%,${pa.toFixed(3)})`; ctx.fill();
            }
          }
        }
        ctx.restore();
      }
    }

    // ── LED dot wave grid ─────────────────────────────────────────────────────
    function drawLEDGrid(t: number, ms: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const spacing = 46;
      const cols = Math.floor(W / spacing) + 1;
      const rows = Math.floor(H / spacing) + 1;
      const padX = (W - (cols - 1) * spacing) / 2;
      const padY = (H - (rows - 1) * spacing) / 2;
      const waveSpd = ms * 0.0014;
      const waveAmp = spacing * 0.38;

      // Dark overlay
      ctx.fillStyle = `rgba(2,6,18,${(t * 0.88).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const x     = padX + c * spacing;
          const baseY = padY + r * spacing;
          const wave  = Math.sin(c * 0.38 + waveSpd) * waveAmp * t
                      + Math.sin(r * 0.22 + waveSpd * 0.55) * waveAmp * 0.35 * t;
          const y     = baseY + wave;
          const br    = 0.45 + 0.55 * Math.sin(c * 0.38 + waveSpd);
          const a     = (0.30 + br * 0.60) * t;

          const dotR = 3.2 + br * 2.2;
          // Soft glow — single semi-transparent circle, no gradient
          ctx.beginPath(); ctx.arc(x, y, dotR * 4.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(120,195,255,${(a * 0.10).toFixed(2)})`;
          ctx.fill();
          // Core dot
          ctx.beginPath(); ctx.arc(x, y, dotR, 0, Math.PI * 2);
          ctx.fillStyle = `hsla(200,90%,${Math.floor(68 + br * 28)}%,${(a * 0.96).toFixed(2)})`;
          ctx.fill();
        }
      }

      // Panel label
      const panAlpha = clamp(t * 2);
      if (panAlpha > 0.01) {
        ctx.save();
        ctx.globalAlpha = panAlpha;
        ctx.textAlign = "center"; ctx.textBaseline = "bottom";
        ctx.font = `300 11px -apple-system,sans-serif`;
        ctx.letterSpacing = "0.22em";
        ctx.fillStyle = "rgba(140,200,255,0.72)";
        ctx.fillText("PARALLEL PROCESSING", W / 2, H * 0.14);
        ctx.font = `500 clamp(36px,5.5vw,72px) Georgia,serif`;
        ctx.fillStyle = "#ffffff";
        ctx.shadowColor = "rgba(2,6,18,1)"; ctx.shadowBlur = 40;
        ctx.fillText("Five agents.", W / 2, H * 0.52);
        ctx.fillText("One signal.", W / 2, H * 0.52 + Math.min(innerWidth, innerHeight) * 0.09);
        ctx.restore();
      }
    }

    // ── Neural cables ─────────────────────────────────────────────────────────
    function drawNeuralCables(t: number, ms: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const cx = W / 2, cy = H / 2;

      ctx.fillStyle = `rgba(3,8,22,${(t * 0.78).toFixed(3)})`;
      ctx.fillRect(0, 0, W, H);

      // Cable origins → center
      type CableDef = { ox: number; oy: number; ex: number; ey: number; hue: number };
      const cables: CableDef[] = [
        { ox: -W * 0.06, oy: cy - H * 0.40, ex: cx - W * 0.03, ey: cy, hue: 206 },
        { ox: -W * 0.06, oy: cy - H * 0.20, ex: cx - W * 0.03, ey: cy, hue: 212 },
        { ox: -W * 0.06, oy: cy,             ex: cx - W * 0.03, ey: cy, hue: 208 },
        { ox: -W * 0.06, oy: cy + H * 0.20, ex: cx - W * 0.03, ey: cy, hue: 215 },
        { ox: -W * 0.06, oy: cy + H * 0.40, ex: cx - W * 0.03, ey: cy, hue: 202 },
        { ox: W * 1.06,  oy: cy - H * 0.40, ex: cx + W * 0.03, ey: cy, hue: 194 },
        { ox: W * 1.06,  oy: cy - H * 0.20, ex: cx + W * 0.03, ey: cy, hue: 200 },
        { ox: W * 1.06,  oy: cy,             ex: cx + W * 0.03, ey: cy, hue: 197 },
        { ox: W * 1.06,  oy: cy + H * 0.20, ex: cx + W * 0.03, ey: cy, hue: 204 },
        { ox: W * 1.06,  oy: cy + H * 0.40, ex: cx + W * 0.03, ey: cy, hue: 192 },
      ];

      for (const cb of cables) {
        const midX = (cb.ox + cb.ex) / 2;
        const cpY  = cb.oy + (cb.ey - cb.oy) * 0.35;
        for (let strand = 0; strand < 3; strand++) {
          const off = (strand - 1) * 6;
          ctx.beginPath();
          ctx.moveTo(cb.ox, cb.oy + off);
          ctx.bezierCurveTo(midX, cpY + off, midX, cy + off, cb.ex, cb.ey + off);
          ctx.strokeStyle = `hsla(${cb.hue},78%,62%,${((0.14 + strand * 0.05) * t).toFixed(3)})`;
          ctx.lineWidth = 2.8 - strand * 0.6;
          ctx.stroke();
        }
      }

      // Center convergence glow
      const phase = ms * 0.002;
      const glowLevels: [number, number, number, number][] = [
        [80, 80, 200, 255],
        [55, 55, 140, 255],
        [30, 30, 100, 255],
      ];
      for (const [r, cr, cg, cb] of glowLevels) {
        const p2 = 0.4 + 0.6 * Math.sin(phase + r * 0.08);
        const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
        g.addColorStop(0, `rgba(${cr},${cg},${cb},${(p2 * t * 0.38).toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
      }

      // Spark nodes
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * Math.PI * 2 + phase;
        const nr  = 16 + 9 * Math.sin(phase * 2.1 + i * 1.3);
        const sx  = cx + Math.cos(ang) * nr;
        const sy  = cy + Math.sin(ang) * nr;
        const sg  = ctx.createRadialGradient(sx, sy, 0, sx, sy, 7);
        sg.addColorStop(0, `rgba(195,238,255,${t.toFixed(3)})`);
        sg.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 7, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${t.toFixed(3)})`; ctx.fill();
      }

      // Marketing text
      const txA = clamp((t - 0.38) / 0.45) * t;
      if (txA > 0.01) {
        ctx.save();
        ctx.globalAlpha  = txA;
        ctx.textAlign    = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor  = "rgba(90,175,255,0.85)";
        ctx.shadowBlur   = 28;
        const fSize = Math.max(28, Math.min(54, W * 0.036));
        const textY = cy - Math.min(W, H) * 0.20;
        ctx.font = `300 ${fSize}px Georgia,serif`;
        ctx.fillStyle = "#e8edf8";
        ctx.fillText("Your personal AI", cx, textY);
        ctx.fillText("Wall Street analyst.", cx, textY + fSize * 1.35);
        const subSize = Math.max(11, Math.min(16, W * 0.011));
        ctx.shadowBlur = 0;
        ctx.font = `400 ${subSize}px -apple-system,sans-serif`;
        ctx.fillStyle = "rgba(140,200,255,0.70)";
        ctx.fillText("FIVE AGENTS  ·  ONE VERDICT  ·  EVERY SOURCE CITED", cx, textY + fSize * 3.05);
        ctx.restore();
      }
    }

    // ── CONVIQT wordmark (constellation dots) ────────────────────────────────
    function drawC(t: number) {
      if (t <= 0) return;
      const W = innerWidth, H = innerHeight;
      const cx = W / 2, cy = H / 2;
      const dots  = cDotsRef.current;
      const edges = wordmarkEdgesRef.current;
      const N = dots.length;
      if (N === 0) return;

      // Ambient purple glow
      const gr = Math.min(W, H) * 0.55;
      const bg = ctx.createRadialGradient(cx, cy, 0, cx, cy, gr);
      bg.addColorStop(0, `rgba(55,18,165,${(t * 0.30).toFixed(3)})`);
      bg.addColorStop(1, "rgba(55,18,165,0)");
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Constellation edges — batch into one path for performance
      const edgeAlpha = clamp(t * 2.2) * 0.38;
      if (edgeAlpha > 0.005) {
        ctx.beginPath();
        ctx.strokeStyle = `rgba(160,200,255,${edgeAlpha.toFixed(3)})`;
        ctx.lineWidth = 0.65;
        for (const [i, j] of edges) {
          const a = dots[i], b = dots[j];
          if (!a || !b) continue;
          ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        }
        ctx.stroke();
      }

      // Dots — reveal left-to-right (staggered by x position)
      const xMin = dots.reduce((m, d) => Math.min(m, d.x), Infinity);
      const xMax = dots.reduce((m, d) => Math.max(m, d.x), -Infinity);
      const xRange = xMax - xMin || 1;
      for (let i = 0; i < N; i++) {
        const { x, y } = dots[i];
        const xFrac  = (x - xMin) / xRange;
        const dotT   = clamp((t - xFrac * 0.52) / 0.28);
        if (dotT <= 0) continue;
        const hue  = 218 + xFrac * 32;
        const size = 3.0 * dotT;  // slightly larger to compensate for removed gradient glow
        ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},88%,97%,${dotT.toFixed(2)})`; ctx.fill();
      }
    }

    // ── Mouse glow (interactive background) ──────────────────────────────────
    function drawMouseGlow() {
      const { x, y } = mousePosRef.current;
      if (x < 0 || y < 0) return;
      const r = Math.min(innerWidth, innerHeight) * 0.32;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0,    "rgba(100,155,255,0.065)");
      g.addColorStop(0.42, "rgba(79,120,247,0.025)");
      g.addColorStop(1,    "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, innerWidth, innerHeight);
    }

    function scheduleNext() {
      drawMouseGlow();
      rafRef.current = requestAnimationFrame(draw);
    }

    // ── Main loop ─────────────────────────────────────────────────────────────
    let running = true;

    function draw() {
      if (!running) return;
      const W  = innerWidth, H = innerHeight;
      const ms = performance.now() - t0;
      const scrollable = section.offsetHeight - innerHeight;
      const p  = clamp(-section.getBoundingClientRect().top / scrollable);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // P1 – Landing
      if (p < LAND_END) {
        canvas.style.opacity  = "0";
        landing.style.opacity = "1";
        landing.style.display = "";
        drawStars(0.7, ms);
        scheduleNext();
        return;
      }

      // P2 – Galaxy beam
      if (p < BEAM_END) {
        const t = (p - LAND_END) / (BEAM_END - LAND_END);
        const landA = t < 0.12 ? 1 - t / 0.12 : 0;
        canvas.style.opacity  = "1";
        landing.style.opacity = landA > 0 ? landA.toFixed(3) : "0";
        if (landA <= 0) landing.style.display = "none";
        drawStars(1, ms);
        drawGalaxyBeam(eOut(t), ms);
        scheduleNext();
        return;
      }
      landing.style.display = "none";

      // P3 – Aurora
      if (p < AUR_END) {
        const t = (p - BEAM_END) / (AUR_END - BEAM_END);
        canvas.style.opacity = "1";
        drawStars(1 - t * 0.55, ms);
        drawGalaxyBeam(1 - eIn(t), ms);
        drawAurora(eOut(t), ms);
        scheduleNext();
        return;
      }

      // P4 – Black hole
      if (p < HOLE_END) {
        const t = (p - AUR_END) / (HOLE_END - AUR_END);
        canvas.style.opacity = "1";
        drawStars(0.5 - t * 0.3, ms);
        drawAurora(1 - eIn(t), ms);
        drawBlackHole(eOut(t), ms);
        scheduleNext();
        return;
      }

      // P5 – Globe builds
      if (p < BUILD_END) {
        const t = (p - HOLE_END) / (BUILD_END - HOLE_END);
        canvas.style.opacity = "1";
        drawStars(0.3 + eOut(t) * 0.7, ms);
        drawBlackHole(1 - eIn(t), ms);
        drawGlobe(t * Math.PI * 0.75, eOut(clamp(t * 1.1)), 1.0, eOut(t), ms);
        scheduleNext();
        return;
      }

      // P6 – Globe hold + agent labels
      if (p < HOLD_END) {
        const t = (p - BUILD_END) / (HOLD_END - BUILD_END);
        canvas.style.opacity = "1";
        drawStars(1, ms);
        drawGlobe(Math.PI * 0.75 + t * Math.PI * 3, 1, 1, 1, ms);
        drawLabels(p, ms);
        scheduleNext();
        return;
      }

      // P7 – LED grid
      if (p < LED_END) {
        const t = (p - HOLD_END) / (LED_END - HOLD_END);
        canvas.style.opacity = "1";
        drawStars(1 - t, ms);
        drawGlobe(Math.PI * 0.75 + Math.PI * 3 + t * Math.PI * 0.55, 1, 1, 1 - eIn(t * 0.75), ms);
        drawLEDGrid(eOut(t), ms);
        scheduleNext();
        return;
      }

      // P8 – Neural cables
      if (p < CABL_END) {
        const t = (p - LED_END) / (CABL_END - LED_END);
        canvas.style.opacity = "1";
        drawLEDGrid(1 - eIn(t), ms);
        drawNeuralCables(eOut(t), ms);
        scheduleNext();
        return;
      }

      // P9 – C-shape morph finale
      {
        const t = (p - CABL_END) / (1 - CABL_END);
        const cableA = clamp(1 - t / 0.36);
        canvas.style.opacity = "1";
        if (cableA > 0.01) drawNeuralCables(cableA, ms);
        drawC(clamp((t - 0.12) / 0.88));
      }

      scheduleNext();
    }

    draw();

    return () => {
      running = false;
      removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Scroll tracker + mouse tracker for HTML overlays
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;
    const onScroll = () => {
      const scrollable = section.offsetHeight - window.innerHeight;
      if (scrollable <= 0) return;
      setScrollP(clamp(-section.getBoundingClientRect().top / scrollable));
    };
    const onMouse = (e: MouseEvent) => {
      mousePosRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("mousemove", onMouse, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("mousemove", onMouse);
    };
  }, []);

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <div ref={sectionRef} style={{ height: TOTAL_H }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden" style={{ background: BG }}>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          className="absolute inset-0 pointer-events-none"
          style={{ zIndex: 2, opacity: 0 }}
        />

        {/* Landing overlay */}
        <div ref={landingRef} className="absolute inset-0" style={{ zIndex: 3 }}>
          <nav style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "28px 52px", position: "relative", zIndex: 4,
          }}>
            <span style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 400, fontSize: "17px", letterSpacing: "0.22em",
              textTransform: "uppercase", color: "#e8edf8",
            }}>
              Conviqt
            </span>
            <ul style={{ display: "flex", gap: "44px", listStyle: "none", padding: 0, margin: 0 }}>
              {[
                { label: "Research",     href: "/chat" },
                { label: "Learn",        href: "/learn" },
                { label: "Alpha",        href: "/alpha" },
                { label: "Pricing",      href: "/pricing" },
                { label: "Methodology",  href: "/methodology" },
              ].map(({ label, href }) => (
                <li key={label}>
                  <Link href={href} style={{
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: "14px", letterSpacing: "0.04em",
                    color: "#e8edf8", textDecoration: "none", opacity: 0.72,
                  }}>
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/chat" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px", letterSpacing: "0.14em", textTransform: "uppercase",
              color: "#e8edf8", background: "transparent",
              border: "1px solid rgba(232,237,248,0.55)",
              borderRadius: "100px", padding: "11px 26px",
              display: "flex", alignItems: "center", gap: "9px",
              textDecoration: "none",
            }}>
              Analyze a Stock <span style={{ fontSize: "18px", lineHeight: "0" }}>•</span>
            </Link>
          </nav>

          {/* Hero copy */}
          <div style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            textAlign: "center", padding: "0 6%",
          }}>
            <p style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px", letterSpacing: "0.24em", textTransform: "uppercase",
              color: "rgba(110,182,255,0.72)", marginBottom: "22px",
            }}>
              AI Equity Research
            </p>

            <h1 style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 500,
              fontSize: "clamp(46px, 6vw, 96px)",
              lineHeight: 1.06, maxWidth: "920px", marginBottom: "26px",
              color: "#e8edf8", letterSpacing: "-0.018em",
            }}>
              <span style={{
                background: "linear-gradient(108deg, #6eb6ff 0%, #c084fc 38%, #f472b6 65%, #67e8f9 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                Five minds.
              </span>{" "}
              One verdict.
            </h1>

            <p style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(15px, 1.55vw, 21px)",
              color: "rgba(232,237,248,0.52)",
              marginBottom: "56px", letterSpacing: "0.015em",
              maxWidth: "460px", lineHeight: 1.68,
            }}>
              Five specialist AI agents debate every stock in parallel —
              every claim linked to a source you can verify.
            </p>

            <Link href="/chat" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px", letterSpacing: "0.18em", textTransform: "uppercase",
              color: "#e8edf8", background: "transparent",
              border: "1px solid rgba(232,237,248,0.38)",
              borderRadius: "100px", padding: "17px 44px",
              display: "flex", alignItems: "center", gap: "14px",
              textDecoration: "none",
            }}>
              Start Research <span style={{ fontSize: "22px", lineHeight: "0" }}>•</span>
            </Link>

            <div style={{
              position: "absolute", bottom: "44px", left: "50%",
              transform: "translateX(-50%)",
              display: "flex", flexDirection: "column", alignItems: "center", gap: "8px",
              opacity: 0.38, animation: "scrollHint 2.2s ease-in-out infinite",
            }}>
              <span style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "9px", letterSpacing: "0.22em",
                textTransform: "uppercase", color: "#e8edf8",
              }}>Scroll</span>
              <svg width="16" height="26" viewBox="0 0 16 26" fill="none">
                <rect x="6.5" y="5" width="3" height="7" rx="1.5" fill="#e8edf8" />
                <rect x="0.5" y="0.5" width="15" height="25" rx="7.5" stroke="#e8edf8" strokeOpacity="0.4" />
              </svg>
            </div>
          </div>

          {/* Cookie notice */}
          {cookieVisible && (
            <div style={{
              position: "fixed", bottom: "28px", right: "28px", zIndex: 20,
              background: "#070e1f",
              border: "1px solid rgba(79,135,247,0.20)",
              borderRadius: "18px", padding: "26px 22px 20px", width: "272px",
            }}>
              <button
                onClick={() => setCookieVisible(false)}
                style={{
                  position: "absolute", top: "13px", right: "15px",
                  background: "none", border: "none", color: "#3d5278",
                  cursor: "pointer", fontSize: "14px",
                }}
              >✕</button>
              <span style={{ fontSize: "30px", display: "block", marginBottom: "11px" }}>🍪</span>
              <p style={{
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "12px", lineHeight: 1.7,
                color: "rgba(232,237,248,0.48)", marginBottom: "15px",
              }}>
                We use cookies. By continuing you consent to our Privacy Policy.
              </p>
              <button
                onClick={() => setCookieVisible(false)}
                style={{
                  width: "100%",
                  fontFamily: "var(--font-serif), Georgia, serif",
                  fontSize: "10px", letterSpacing: "0.12em", textTransform: "uppercase",
                  color: "#e8edf8", background: "transparent",
                  border: "1px solid rgba(232,237,248,0.42)",
                  borderRadius: "100px", padding: "12px", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: "7px",
                }}
              >
                Accept <span style={{ fontSize: "16px", lineHeight: "0" }}>•</span>
              </button>
            </div>
          )}
        </div>

        {/* Feature education panels */}
        {PANELS.map(({ start, peak, end, label, head, body }) => {
          const rawT = scrollP >= start && scrollP <= end
            ? scrollP <= peak
              ? (scrollP - start) / (peak - start)
              : 1 - (scrollP - peak) / (end - peak)
            : 0;
          const opacity = eOut(clamp(rawT));
          if (opacity < 0.005) return null;
          return (
            <div key={label} style={{
              position: "absolute", inset: 0, zIndex: 4,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              textAlign: "center", padding: "0 6%",
              opacity,
              transform: `translateY(${(1 - opacity) * 30}px)`,
              pointerEvents: "none",
            }}>
              <div style={{
                position: "absolute", inset: 0,
                background: "radial-gradient(ellipse 72% 58% at 50% 50%, rgba(2,6,18,0.68) 0%, rgba(2,6,18,0.32) 55%, transparent 100%)",
                pointerEvents: "none",
              }} />
              <p style={{
                position: "relative",
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "11px", letterSpacing: "0.26em", textTransform: "uppercase",
                color: "rgba(140,200,255,0.95)", margin: "0 0 20px",
                textShadow: "0 0 24px rgba(2,6,18,0.9)",
              }}>
                {label}
              </p>
              <h2 style={{
                position: "relative",
                fontFamily: "var(--font-display), Georgia, serif",
                fontWeight: 500, fontSize: "clamp(46px, 6vw, 96px)",
                lineHeight: 1.06, maxWidth: "820px", color: "#ffffff",
                letterSpacing: "-0.018em", margin: "0 0 28px",
                textShadow: "0 2px 48px rgba(2,6,18,1), 0 0 120px rgba(2,6,18,0.95)",
              }}>
                {head.map((line, i) => <span key={i} style={{ display: "block" }}>{line}</span>)}
              </h2>
              <p style={{
                position: "relative",
                fontFamily: "var(--font-serif), Georgia, serif",
                fontSize: "clamp(15px, 1.55vw, 19px)", color: "rgba(215,230,248,0.90)",
                letterSpacing: "0.012em", maxWidth: "460px", lineHeight: 1.72,
                margin: 0, textShadow: "0 1px 28px rgba(2,6,18,0.95)",
              }}>
                {body}
              </p>
            </div>
          );
        })}

        {/* ── Interactive Nav Bar (top centre) ─────────────────────────────── */}
        <div style={{
          position: "absolute",
          top: "18px",
          left: "50%",
          transform: sidebarOn
            ? "translateX(-50%) translateY(0px)"
            : "translateX(-50%) translateY(-22px)",
          zIndex: 10,
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "2px",
          opacity: sidebarOn ? 1 : 0,
          transition: "opacity 0.50s ease, transform 0.50s ease",
          pointerEvents: sidebarOn ? "auto" : "none",
          background: "rgba(4,12,36,0.88)",
          backdropFilter: "blur(18px)",
          WebkitBackdropFilter: "blur(18px)",
          border: "1px solid rgba(79,135,247,0.50)",
          borderRadius: "100px",
          padding: "5px",
        }}>
          {SIDEBAR.map((item, i) => {
            const isHovered = hoverNav === item.label;
            return (
              <Link
                key={item.label}
                href={item.href}
                onMouseEnter={() => setHoverNav(item.label)}
                onMouseLeave={() => setHoverNav(null)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 16px",
                  borderRadius: "100px",
                  textDecoration: "none",
                  background: isHovered ? "rgba(79,135,247,0.15)" : "transparent",
                  border: `1px solid ${isHovered ? "rgba(79,135,247,0.36)" : "transparent"}`,
                  transition: "all 0.20s ease",
                  transitionDelay: `${0.04 + i * 0.05}s`,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{
                  fontFamily: "monospace",
                  fontSize: "11px",
                  color: isHovered ? "rgba(120,170,255,1)" : "rgba(110,165,255,0.85)",
                  transition: "color 0.2s",
                  lineHeight: 1,
                }}>
                  {item.icon}
                </span>
                <span style={{
                  fontFamily: "var(--font-serif), Georgia, serif",
                  fontSize: "11px",
                  letterSpacing: "0.04em",
                  color: isHovered ? "#e8edf8" : "rgba(232,237,248,0.88)",
                  transition: "color 0.2s",
                }}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* CTA Buttons — appear at end of CONVIQT animation */}
        {scrollP > 0.92 && (
          <div style={{
            position: "absolute",
            bottom: "11%",
            left: "50%",
            transform: `translateX(-50%) translateY(${((1 - clamp((scrollP - 0.92) / 0.05)) * 40).toFixed(1)}px)`,
            opacity: clamp((scrollP - 0.92) / 0.05),
            zIndex: 10,
            display: "flex",
            gap: "14px",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "center",
          }}>
            <Link href="/learn" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "12px", letterSpacing: "0.10em", textTransform: "uppercase",
              color: "#1a1206", textDecoration: "none", fontWeight: 600,
              background: "linear-gradient(135deg, #fcd34d 0%, #f59e0b 100%)",
              borderRadius: "100px", padding: "14px 34px",
              boxShadow: "0 0 34px rgba(245,158,11,0.6), 0 2px 8px rgba(0,0,0,0.5)",
              border: "1px solid rgba(252,211,77,0.65)",
              whiteSpace: "nowrap",
            }}>
              Start Learning Free
            </Link>
            <Link href="/chat" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "12px", letterSpacing: "0.10em", textTransform: "uppercase",
              color: "#ffffff", textDecoration: "none",
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)",
              borderRadius: "100px", padding: "14px 32px",
              boxShadow: "0 0 28px rgba(59,130,246,0.55), 0 2px 8px rgba(0,0,0,0.5)",
              border: "1px solid rgba(100,170,255,0.45)",
              whiteSpace: "nowrap",
            }}>
              Go to Chat
            </Link>
            <Link href="/alpha" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "12px", letterSpacing: "0.10em", textTransform: "uppercase",
              color: "#ffffff", textDecoration: "none",
              background: "linear-gradient(135deg, #10b981 0%, #047857 100%)",
              borderRadius: "100px", padding: "14px 32px",
              boxShadow: "0 0 28px rgba(16,185,129,0.50), 0 2px 8px rgba(0,0,0,0.5)",
              border: "1px solid rgba(52,211,153,0.45)",
              whiteSpace: "nowrap",
            }}>
              Go to Alpha Tracker
            </Link>
            <Link href="/methodology" style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "12px", letterSpacing: "0.10em", textTransform: "uppercase",
              color: "rgba(232,237,248,0.92)", textDecoration: "none",
              background: "rgba(10,20,55,0.60)",
              borderRadius: "100px", padding: "14px 32px",
              boxShadow: "0 0 20px rgba(167,139,250,0.28), 0 2px 8px rgba(0,0,0,0.5)",
              border: "1px solid rgba(167,139,250,0.55)",
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              whiteSpace: "nowrap",
            }}>
              See our Methodology
            </Link>
          </div>
        )}

        {/* Scroll progress indicator (right side) */}
        <div style={{
          position: "absolute",
          right: "24px",
          top: "50%",
          transform: "translateY(-50%)",
          zIndex: 10,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "8px",
          opacity: scrollP > 0.04 && scrollP < 0.98 ? 1 : 0,
          transition: "opacity 0.4s",
          pointerEvents: "none",
        }}>
          {/* Track */}
          <div style={{
            width: "2px", height: "120px",
            background: "rgba(79,135,247,0.15)",
            borderRadius: "2px",
            position: "relative",
            overflow: "hidden",
          }}>
            {/* Fill */}
            <div style={{
              position: "absolute", top: 0, left: 0, right: 0,
              height: `${scrollP * 100}%`,
              background: "linear-gradient(to bottom, rgba(79,135,247,0.8), rgba(100,200,255,0.8))",
              borderRadius: "2px",
              transition: "height 0.1s",
            }} />
          </div>
          <span style={{
            fontFamily: "var(--font-serif), Georgia, serif",
            fontSize: "8px", letterSpacing: "0.14em", textTransform: "uppercase",
            color: "rgba(79,135,247,0.45)",
            writingMode: "vertical-rl",
            transform: "rotate(180deg)",
          }}>
            {Math.round(scrollP * 100)}%
          </span>
        </div>

      </div>

      <style>{`
        @keyframes scrollHint {
          0%, 100% { opacity: 0.25; transform: translateX(-50%) translateY(0px); }
          50%       { opacity: 0.50; transform: translateX(-50%) translateY(7px); }
        }
      `}</style>
    </div>
  );
}
