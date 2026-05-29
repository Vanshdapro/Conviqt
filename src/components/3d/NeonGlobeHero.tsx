"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const BG = "#050d1a";

// ── Helpers ────────────────────────────────────────────────────────────────────
function sr(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

const clamp = (v: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
const eOut = (t: number) => 1 - (1 - t) ** 3;

// ── Fibonacci sphere ────────────────────────────────────────────────────────────
type SphereDot = { x: number; y: number; z: number };
function buildSphere(N = 1100): SphereDot[] {
  const phi = Math.PI * (Math.sqrt(5) - 1);
  return Array.from({ length: N }, (_, i) => {
    const y = 1 - (i / (N - 1)) * 2;
    const r = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = phi * i;
    return { x: Math.cos(theta) * r, y, z: Math.sin(theta) * r };
  });
}
const SPHERE = buildSphere();

// ── Stars ───────────────────────────────────────────────────────────────────────
type Star = { x: number; y: number; r: number; a: number; phase: number };
function buildStars(W: number, H: number): Star[] {
  return Array.from({ length: 220 }, (_, i) => ({
    x: sr(i * 7 + 1) * W,
    y: sr(i * 7 + 2) * H,
    r: sr(i * 7 + 3) * 1.4 + 0.2,
    a: sr(i * 7 + 4) * 0.55 + 0.1,
    phase: sr(i * 7 + 5) * Math.PI * 2,
  }));
}

// ── Canvas card renderer ────────────────────────────────────────────────────────
function drawCard(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  titleText: string,
  subText: string,
  rows: Array<{ label: string; value: string; color?: string }>,
  tagText: string,
  alpha: number,
) {
  ctx.save();
  ctx.globalAlpha = clamp(alpha);

  // Shadow glow behind card
  ctx.shadowColor = "rgba(79,135,247,0.35)";
  ctx.shadowBlur = 24;

  // Glass bg
  ctx.beginPath();
  (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void }).roundRect(x, y, w, h, 12);
  ctx.fillStyle = "rgba(5,12,26,0.88)";
  ctx.fill();
  ctx.shadowBlur = 0;

  // Border
  ctx.strokeStyle = "rgba(79,135,247,0.38)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Top shimmer line
  const tg = ctx.createLinearGradient(x, y, x + w, y);
  tg.addColorStop(0, "rgba(79,135,247,0)");
  tg.addColorStop(0.35, "rgba(140,195,255,0.75)");
  tg.addColorStop(0.65, "rgba(140,195,255,0.75)");
  tg.addColorStop(1, "rgba(79,135,247,0)");
  ctx.strokeStyle = tg;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(x + 12, y + 0.6);
  ctx.lineTo(x + w - 12, y + 0.6);
  ctx.stroke();

  const pad = 14;
  ctx.textBaseline = "middle";
  ctx.shadowBlur = 0;

  // Title
  ctx.font = `600 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
  ctx.fillStyle = "#e8edf8";
  ctx.textAlign = "left";
  ctx.fillText(titleText, x + pad, y + 19);

  // Live indicator dot
  const dotX = x + w - pad - 5, dotY = y + 19;
  const dotGlow = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, 9);
  dotGlow.addColorStop(0, "rgba(79,135,247,0.5)");
  dotGlow.addColorStop(1, "rgba(79,135,247,0)");
  ctx.fillStyle = dotGlow;
  ctx.beginPath(); ctx.arc(dotX, dotY, 9, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(dotX, dotY, 3.5, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(110,182,255,0.9)"; ctx.fill();

  // Subtitle
  ctx.font = `300 10px -apple-system,sans-serif`;
  ctx.fillStyle = "rgba(122,146,184,0.85)";
  ctx.fillText(subText, x + pad, y + 34);

  // Divider
  ctx.strokeStyle = "rgba(79,135,247,0.14)";
  ctx.lineWidth = 0.5;
  ctx.beginPath();
  ctx.moveTo(x + pad, y + 44);
  ctx.lineTo(x + w - pad, y + 44);
  ctx.stroke();

  // Rows
  rows.forEach((row, i) => {
    const ry = y + 56 + i * 21;
    ctx.font = `300 10px -apple-system,sans-serif`;
    ctx.fillStyle = "rgba(122,146,184,0.72)";
    ctx.textAlign = "left";
    ctx.fillText(row.label, x + pad, ry);

    ctx.font = `500 11px -apple-system,sans-serif`;
    ctx.fillStyle = row.color ?? "rgba(232,237,248,0.88)";
    ctx.textAlign = "right";
    ctx.fillText(row.value, x + w - pad, ry);
  });
  ctx.textAlign = "left";

  // Tag line
  ctx.font = `300 9px -apple-system,sans-serif`;
  ctx.fillStyle = "rgba(79,135,247,0.52)";
  ctx.fillText(tagText, x + pad, y + h - 11);

  ctx.restore();
}

// ── Connector line + traveling packet ──────────────────────────────────────────
function drawConnector(
  ctx: CanvasRenderingContext2D,
  x1: number, y1: number,
  x2: number, y2: number,
  alpha: number,
  t: number,
  phase = 0,
) {
  ctx.save();
  ctx.globalAlpha = alpha * 0.3;
  ctx.strokeStyle = "#4f87f7";
  ctx.lineWidth = 0.75;
  ctx.setLineDash([3, 9]);
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
  ctx.setLineDash([]);

  const pT = (t * 0.00085 + phase) % 1;
  const ppx = x1 + (x2 - x1) * pT;
  const ppy = y1 + (y2 - y1) * pT;
  ctx.globalAlpha = alpha * 0.82;
  const pg = ctx.createRadialGradient(ppx, ppy, 0, ppx, ppy, 5.5);
  pg.addColorStop(0, "rgba(110,185,255,0.95)");
  pg.addColorStop(1, "rgba(110,185,255,0)");
  ctx.fillStyle = pg;
  ctx.beginPath(); ctx.arc(ppx, ppy, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ── Main component ──────────────────────────────────────────────────────────────
export default function NeonGlobeHero() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const t0Ref = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let stars: Star[] = [];
    t0Ref.current = performance.now();

    const resize = () => {
      canvas.width = innerWidth;
      canvas.height = innerHeight;
      stars = buildStars(innerWidth, innerHeight);
    };
    resize();
    addEventListener("resize", resize);

    function frame() {
      const W = canvas.width, H = canvas.height;
      const t = performance.now() - t0Ref.current;
      const fadeIn = clamp(t / 1800, 0, 1);

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = BG;
      ctx.fillRect(0, 0, W, H);

      // ── STARS ─────────────────────────────────────────────────────────────
      for (const s of stars) {
        const tw = 0.6 + 0.4 * Math.sin(t * 0.00065 + s.phase);
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(175,210,255,${(s.a * tw * fadeIn).toFixed(3)})`;
        ctx.fill();
      }

      // Globe center — slightly right of viewport center
      const cx = W * 0.52;
      const cy = H * 0.5;
      const R = clamp(Math.min(W, H) * 0.285, 80, 280);
      const pulse = 1 + 0.055 * Math.sin(t * 0.00088);
      const rotY = t * 0.00022 + 0.4;
      const cosR = Math.cos(rotY), sinR = Math.sin(rotY);
      const FOV = 780;

      // ── VOLUMETRIC GLOW ────────────────────────────────────────────────────
      const gDef = [
        { radius: R * 3.4 * pulse, ca: [110, 40, 220, 0.08 * fadeIn] },
        { radius: R * 2.5 * pulse, ca: [65, 75, 240, 0.11 * fadeIn] },
        { radius: R * 1.8 * pulse, ca: [45, 125, 255, 0.16 * fadeIn] },
        { radius: R * 1.15 * pulse, ca: [90, 168, 255, 0.22 * fadeIn] },
        { radius: R * 0.68 * pulse, ca: [140, 200, 255, 0.20 * fadeIn] },
      ];
      for (const { radius, ca } of gDef) {
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        g.addColorStop(0, `rgba(${ca[0]},${ca[1]},${ca[2]},${ca[3].toFixed(3)})`);
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }

      // ── WIREFRAME LATITUDE LINES ───────────────────────────────────────────
      for (let lat = -75; lat <= 75; lat += 15) {
        const latRad = lat * Math.PI / 180;
        const sinLat = Math.sin(latRad);
        const cosLat = Math.cos(latRad);
        const N = 72;
        ctx.beginPath();
        let visible = false;
        for (let i = 0; i <= N; i++) {
          const lon = (i / N) * Math.PI * 2;
          const dx = Math.sin(lon) * cosLat;
          const dz = Math.cos(lon) * cosLat;
          const rx = dx * cosR - dz * sinR;
          const rz = dx * sinR + dz * cosR;
          if (rz < -0.28) { visible = false; continue; }
          const s = FOV / (FOV + rz * R * 0.22);
          const px = cx + rx * R * s;
          const py = cy + sinLat * R * s;
          if (!visible) { ctx.moveTo(px, py); visible = true; }
          else ctx.lineTo(px, py);
        }
        const hue = 210 + (lat / 90) * 25;
        ctx.strokeStyle = `hsla(${hue},82%,68%,${(0.17 * fadeIn).toFixed(3)})`;
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }

      // ── SPHERE DOTS ────────────────────────────────────────────────────────
      type PD = { px: number; py: number; depth: number; hue: number };
      const proj: PD[] = [];
      for (const dot of SPHERE) {
        const rx = dot.x * cosR - dot.z * sinR;
        const rz = dot.x * sinR + dot.z * cosR;
        const s = FOV / (FOV + rz * R * 0.22);
        const px = cx + rx * R * s;
        const py = cy + dot.y * R * s;
        const depth = (rz + 1) / 2;
        // Purple (back/left) → blue (center) → cyan (front/right)
        const hue = 264 - ((rx + 1) / 2) * 82;
        proj.push({ px, py, depth, hue });
      }
      proj.sort((a, b) => a.depth - b.depth);

      for (const { px, py, depth, hue } of proj) {
        if (depth < 0.04) continue;
        const a = clamp((0.12 + depth * 0.88) * fadeIn);
        const size = clamp(0.5 + depth * 2.6, 0.4, 4.5) * (R / 200);

        if (depth > 0.42) {
          const gr = size * 5.5;
          const g = ctx.createRadialGradient(px, py, 0, px, py, gr);
          g.addColorStop(0, `hsla(${hue},92%,74%,${(a * 0.52).toFixed(3)})`);
          g.addColorStop(1, `hsla(${hue},92%,74%,0)`);
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(px, py, gr, 0, Math.PI * 2); ctx.fill();
        }
        ctx.beginPath(); ctx.arc(px, py, clamp(size, 0.4), 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${hue},88%,84%,${a.toFixed(3)})`;
        ctx.fill();
      }

      // ── FLOATING DATA CARDS ────────────────────────────────────────────────
      if (W >= 900 && fadeIn > 0.45) {
        const cardA = eOut(clamp((fadeIn - 0.45) / 0.55));

        // Card 1: Ticker Analysis (left of globe)
        const c1w = 192, c1h = 152;
        const c1x = cx - R * 1.68 - c1w;
        const c1y = cy - c1h / 2 + Math.sin(t * 0.00095) * 13;
        drawCard(ctx, c1x, c1y, c1w, c1h,
          "NVDA", "NVIDIA Corporation",
          [
            { label: "Council Verdict", value: "BUY", color: "#22c55e" },
            { label: "Confidence", value: "87%" },
            { label: "Price Target", value: "$1,240" },
            { label: "Disagree Score", value: "Low", color: "#6eb6ff" },
          ],
          "The Council · just now",
          cardA * (0.72 + 0.15 * Math.sin(t * 0.0014)),
        );
        drawConnector(ctx,
          c1x + c1w + 5, c1y + c1h / 2,
          cx - R * 0.97, cy,
          cardA, t, 0,
        );

        // Card 2: The Council (right of globe)
        const c2w = 178, c2h = 165;
        const c2x = cx + R * 1.68;
        const c2y = cy - c2h / 2 + Math.sin(t * 0.00095 + 2.1) * 11;
        drawCard(ctx, c2x, c2y, c2w, c2h,
          "The Council", "5 AI Specialists",
          [
            { label: "Sweep Agent", value: "BUY", color: "#22c55e" },
            { label: "Fundamentals", value: "BUY", color: "#22c55e" },
            { label: "Technicals", value: "BUY", color: "#22c55e" },
            { label: "Sentiment", value: "HOLD", color: "#f59e0b" },
            { label: "Macro", value: "BUY", color: "#22c55e" },
          ],
          "4 of 5 agents · consensus",
          cardA * (0.68 + 0.15 * Math.sin(t * 0.0014 + 2)),
        );
        drawConnector(ctx,
          cx + R * 0.97, cy,
          c2x - 5, c2y + c2h / 2,
          cardA, t, 0.5,
        );

        // Card 3: Citation Engine (below globe) — only on wide screens
        if (W >= 1100) {
          const c3w = 200, c3h = 115;
          const c3x = cx - c3w / 2 + Math.sin(t * 0.00095 + 1.4) * 9;
          const c3y = cy + R * 1.24;
          drawCard(ctx, c3x, c3y, c3w, c3h,
            "14 Sources", "Citation-First Research",
            [
              { label: "SEC Filings", value: "3" },
              { label: "Analyst Notes", value: "6" },
              { label: "News & Macro", value: "5" },
            ],
            "Every claim is verifiable",
            cardA * (0.60 + 0.15 * Math.sin(t * 0.0014 + 4)),
          );
          drawConnector(ctx,
            cx, cy + R * 1.02,
            c3x + c3w / 2, c3y,
            cardA, t, 0.25,
          );
        }

        // Card 4: Top mini pill — "Alpha Tracker"
        if (W >= 1100) {
          const c4w = 168, c4h = 50;
          const c4x = cx - c4w / 2;
          const c4y = Math.max(96, cy - R * 1.08 - c4h);
          ctx.save();
          ctx.globalAlpha = cardA * (0.55 + 0.15 * Math.sin(t * 0.0014 + 5));
          ctx.beginPath();
          (ctx as CanvasRenderingContext2D & { roundRect: (...a: unknown[]) => void })
            .roundRect(c4x, c4y, c4w, c4h, 25);
          ctx.fillStyle = "rgba(5,12,26,0.85)";
          ctx.fill();
          ctx.strokeStyle = "rgba(79,135,247,0.32)";
          ctx.lineWidth = 1;
          ctx.stroke();
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `500 11px -apple-system,sans-serif`;
          ctx.fillStyle = "#e8edf8";
          ctx.fillText("Alpha Tracker", c4x + c4w / 2, c4y + 18);
          ctx.font = `300 9px -apple-system,sans-serif`;
          ctx.fillStyle = "rgba(79,135,247,0.65)";
          ctx.fillText("Max 2 picks / week", c4x + c4w / 2, c4y + 34);
          ctx.restore();
          drawConnector(ctx,
            cx, cy - R * 1.02,
            c4x + c4w / 2, c4y + c4h,
            cardA * 0.7, t, 0.75,
          );
        }
      }

      raf = requestAnimationFrame(frame);
    }

    frame();
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("resize", resize);
    };
  }, []);

  return (
    <div
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
        background: BG,
      }}
    >
      {/* Animated canvas */}
      <canvas
        ref={canvasRef}
        style={{ position: "absolute", inset: 0, display: "block" }}
      />

      {/* UI layer */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 2,
          display: "flex",
          flexDirection: "column",
          pointerEvents: "none",
        }}
      >
        {/* ── Nav ─────────────────────────────────────────────────────────── */}
        <nav
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "28px 52px",
            pointerEvents: "auto",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 400,
              fontSize: "17px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "#e8edf8",
            }}
          >
            Conviqt
          </span>

          <ul style={{ display: "flex", gap: "44px", listStyle: "none", padding: 0, margin: 0 }}>
            {["Research", "Alpha", "Methodology"].map((l) => (
              <li key={l}>
                <Link
                  href={l === "Research" ? "/chat" : `/${l.toLowerCase()}`}
                  style={{
                    fontFamily: "var(--font-serif), Georgia, serif",
                    fontSize: "14px",
                    letterSpacing: "0.04em",
                    color: "#e8edf8",
                    textDecoration: "none",
                    opacity: 0.75,
                  }}
                >
                  {l}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/chat"
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px",
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#e8edf8",
              background: "transparent",
              border: "1px solid rgba(232,237,248,0.55)",
              borderRadius: "100px",
              padding: "11px 26px",
              display: "flex",
              alignItems: "center",
              gap: "9px",
              cursor: "pointer",
              textDecoration: "none",
            }}
          >
            Analyze a Stock{" "}
            <span style={{ fontSize: "18px", lineHeight: "0" }}>•</span>
          </Link>
        </nav>

        {/* ── Hero text ────────────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "0 6%",
            pointerEvents: "none",
          }}
        >
          {/* Eyebrow label */}
          <p
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px",
              letterSpacing: "0.22em",
              textTransform: "uppercase",
              color: "rgba(110,182,255,0.75)",
              marginBottom: "20px",
            }}
          >
            AI Equity Research
          </p>

          <h1
            style={{
              fontFamily: "var(--font-display), Georgia, serif",
              fontWeight: 500,
              fontSize: "clamp(46px, 6vw, 92px)",
              lineHeight: 1.07,
              maxWidth: "840px",
              marginBottom: "26px",
              color: "#e8edf8",
              letterSpacing: "-0.015em",
            }}
          >
            <span
              style={{
                background:
                  "linear-gradient(108deg, #6eb6ff 0%, #a78bfa 42%, #9df0ff 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              Five minds.
            </span>{" "}
            One verdict.
          </h1>

          <p
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "clamp(15px, 1.55vw, 21px)",
              color: "rgba(232,237,248,0.58)",
              marginBottom: "52px",
              letterSpacing: "0.02em",
              maxWidth: "480px",
              lineHeight: 1.65,
            }}
          >
            Five specialist AI agents debate every stock — and every number
            links back to a source you can verify.
          </p>

          <Link
            href="/chat"
            style={{
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: "11px",
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: "#e8edf8",
              background: "transparent",
              border: "1px solid rgba(232,237,248,0.42)",
              borderRadius: "100px",
              padding: "17px 42px",
              display: "flex",
              alignItems: "center",
              gap: "14px",
              cursor: "pointer",
              textDecoration: "none",
              pointerEvents: "auto",
              transition: "border-color 0.2s, opacity 0.2s",
            }}
          >
            Start Research{" "}
            <span style={{ fontSize: "22px", lineHeight: "0" }}>•</span>
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        [data-conviqt-hero] > div > div > *:nth-child(1) { animation: fadeUp 0.8s ease both 0.2s; }
        [data-conviqt-hero] > div > div > *:nth-child(2) { animation: fadeUp 0.9s ease both 0.4s; }
        [data-conviqt-hero] > div > div > *:nth-child(3) { animation: fadeUp 1s   ease both 0.6s; }
        [data-conviqt-hero] > div > div > *:nth-child(4) { animation: fadeUp 1s   ease both 0.8s; }
      `}</style>
    </div>
  );
}
