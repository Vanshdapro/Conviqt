"use client";

// Shared, token-only SVG/CSS primitives for the specialized Skill Views.
//
// ALMANAC rules (CLAUDE.md): every colour is a token var — never a hex.
// Pacific Blue (--up) and Coral (--down) are used ONLY for directional /
// gain-loss meaning (a bull case, a falling impact, a stress loss). Teal
// (--accent) is the one decorative accent and carries all neutral "quality"
// fills. No 3D, no gradients-as-art — flat tonal fills only.

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Sureness, Forecast } from "@/lib/skillViewTypes";

// ── Motion: one-time reveals (150-220ms ease-out, the only allowed motion) ────
//
// Fade + small rise on mount. Stagger via `delay` so a card's sections settle
// in sequence. Respects prefers-reduced-motion (renders instantly). No 3D, no
// parallax, no scroll-jacking — just the micro-reveal CLAUDE.md permits.

export function Reveal({
  children,
  delay = 0,
  as = "div",
}: {
  children: ReactNode;
  delay?: number;
  as?: "div" | "section" | "li";
}) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setShown(true);
      return;
    }
    const id = window.setTimeout(() => setShown(true), delay);
    return () => window.clearTimeout(id);
  }, [delay]);
  const Tag = as;
  return (
    <Tag
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(6px)",
        transition: "opacity 200ms var(--ease-out), transform 200ms var(--ease-out)",
      }}
    >
      {children}
    </Tag>
  );
}

// ── A number that counts up once on mount (a data reveal, not a hover trick) ──

export function CountUp({
  value,
  decimals = 0,
  prefix = "",
  suffix = "",
  duration = 650,
}: {
  value: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
}) {
  const [n, setN] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !Number.isFinite(value)) {
      setN(Number.isFinite(value) ? value : 0);
      return;
    }
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out cubic
      setN(value * eased);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [value, duration]);
  return (
    <span style={{ fontVariantNumeric: "tabular-nums" }}>
      {prefix}
      {n.toFixed(decimals)}
      {suffix}
    </span>
  );
}

// ── Layout ───────────────────────────────────────────────────────────────────

export function VizCard({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-card)",
        boxShadow: "var(--shadow-card)",
        padding: "var(--space-6)",
      }}
    >
      <header style={{ marginBottom: "var(--space-4)" }}>
        <h3
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 22,
            color: "var(--text)",
            margin: 0,
            letterSpacing: "-0.01em",
          }}
        >
          {title}
        </h3>
        {hint && (
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
      </header>
      {children}
    </section>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "var(--text-muted)",
        margin: "var(--space-4) 0 var(--space-2)",
      }}
    >
      {children}
    </div>
  );
}

// ── Pills ──────────────────────────────────────────────────────────────────

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "up" | "down" | "accent";
}) {
  const map = {
    neutral: { bg: "var(--bg-sunken)", fg: "var(--text-2)" },
    up: { bg: "var(--up-weak)", fg: "var(--up-ink)" },
    down: { bg: "var(--down-weak)", fg: "var(--down-ink)" },
    accent: { bg: "var(--accent-weak)", fg: "var(--accent-hover)" },
  }[tone];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        background: map.bg,
        color: map.fg,
        borderRadius: "var(--radius-pill)",
        padding: "3px 10px",
        fontSize: 13,
        fontWeight: 600,
        lineHeight: 1.3,
      }}
    >
      {children}
    </span>
  );
}

export function SurenessPill({ value }: { value: Sureness }) {
  return <Pill tone="accent">How sure: {value}</Pill>;
}

// Arrow always accompanies colour so meaning never relies on hue alone.
export function DirArrow({ dir }: { dir: "up" | "down" | "mixed" }) {
  if (dir === "up") return <span style={{ color: "var(--up-ink)" }}>▲</span>;
  if (dir === "down") return <span style={{ color: "var(--down-ink)" }}>▼</span>;
  return <span style={{ color: "var(--text-muted)" }}>◆</span>;
}

// ── Semicircle gauge (one or two needles) ────────────────────────────────────
//
// Maps a value on [min,max] to an angle on a 180° arc. Used by the durability
// dial, the sector pulse, the health score, and the Crowd Check twin-needle.

function polar(cx: number, cy: number, r: number, deg: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number) {
  const s = polar(cx, cy, r, startDeg);
  const e = polar(cx, cy, r, endDeg);
  const large = Math.abs(endDeg - startDeg) > 180 ? 1 : 0;
  const sweep = endDeg > startDeg ? 1 : 0;
  return `M ${s.x.toFixed(2)} ${s.y.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${e.x.toFixed(2)} ${e.y.toFixed(2)}`;
}

export interface Needle {
  value: number; // within [min,max]
  color: string; // token var
  label: string;
}

export function Gauge({
  needles,
  min = 0,
  max = 100,
  width = 280,
  leftLabel,
  rightLabel,
  centerLabel,
  centerSub,
}: {
  needles: Needle[];
  min?: number;
  max?: number;
  width?: number;
  leftLabel?: string;
  rightLabel?: string;
  centerLabel?: string;
  centerSub?: string;
}) {
  // Needles sweep from rest to their value once on mount (a data reveal).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setMounted(true);
      return;
    }
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);
  const h = width * 0.62;
  const cx = width / 2;
  const cy = width * 0.52;
  const r = width * 0.42;
  // 180° (left) → 0° (right) is the visible top arc; SVG y grows downward, so
  // we sweep from 180 to 360 (=0) along the upper half.
  const toAngle = (v: number) => {
    const f = Math.max(0, Math.min(1, (v - min) / (max - min)));
    return 180 + f * 180;
  };

  const M = 34; // horizontal slack so end labels ("Greed / Strong") never clip
  return (
    <svg viewBox={`${-M} 0 ${width + 2 * M} ${h}`} width="100%" role="img" aria-label={centerLabel ?? "gauge"}>
      {/* track */}
      <path d={arcPath(cx, cy, r, 180, 360)} fill="none" stroke="var(--bg-sunken)" strokeWidth={16} strokeLinecap="round" />
      {/* subtle midline tick */}
      {(() => {
        const m = polar(cx, cy, r, toAngle((min + max) / 2));
        const mi = polar(cx, cy, r - 16, toAngle((min + max) / 2));
        return <line x1={m.x} y1={m.y} x2={mi.x} y2={mi.y} stroke="var(--border-strong)" strokeWidth={1.5} />;
      })()}
      {needles.map((n, i) => {
        // Draw at rest (pointing left, 180°) and rotate to the value on mount,
        // so the needle sweeps in. Tip lands at angle `toAngle(n.value)`.
        const a = toAngle(n.value);
        const baseTip = polar(cx, cy, r - 6, 180);
        const rot = mounted ? a - 180 : 0;
        return (
          <g
            key={i}
            style={{
              transform: `rotate(${rot}deg)`,
              transformOrigin: `${cx}px ${cy}px`,
              transformBox: "view-box",
              transition: "transform 720ms var(--ease-out)",
            } as React.CSSProperties}
          >
            <line x1={cx} y1={cy} x2={baseTip.x} y2={baseTip.y} stroke={n.color} strokeWidth={3.5} strokeLinecap="round" />
            <circle cx={baseTip.x} cy={baseTip.y} r={5} fill={n.color} />
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={7} fill="var(--text-2)" />
      {centerLabel && (
        <text x={cx} y={cy - r * 0.42} textAnchor="middle" fontFamily="var(--font-display)" fontSize={width * 0.13} fill="var(--text)" fontWeight={700}>
          {centerLabel}
        </text>
      )}
      {centerSub && (
        <text x={cx} y={cy - r * 0.2} textAnchor="middle" fontSize={12} fill="var(--text-muted)">
          {centerSub}
        </text>
      )}
      {leftLabel && (
        <text x={cx - r} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
          {leftLabel}
        </text>
      )}
      {rightLabel && (
        <text x={cx + r} y={cy + 18} textAnchor="middle" fontSize={11} fill="var(--text-muted)">
          {rightLabel}
        </text>
      )}
    </svg>
  );
}

// ── Horizontal score bar ─────────────────────────────────────────────────────

export function ScoreBar({
  label,
  score,
  note,
  tone = "accent",
  max = 100,
}: {
  label: string;
  score: number;
  note?: string;
  tone?: "accent" | "up" | "down";
  max?: number;
}) {
  const fillVar = tone === "up" ? "var(--up)" : tone === "down" ? "var(--down)" : "var(--accent)";
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  return (
    <div style={{ marginBottom: "var(--space-3)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>{label}</span>
        <span style={{ fontSize: 13, color: "var(--text-2)", fontVariantNumeric: "tabular-nums" }}>{Math.round(score)}</span>
      </div>
      <div style={{ height: 8, background: "var(--bg-sunken)", borderRadius: "var(--radius-pill)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: fillVar, borderRadius: "var(--radius-pill)", transition: "width 320ms var(--ease-out)" }} />
      </div>
      {note && <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" }}>{note}</p>}
    </div>
  );
}

// ── Plain numeric formatting ─────────────────────────────────────────────────

export function money(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return "—";
  if (Math.abs(n) >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (Math.abs(n) >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toFixed(2)}`;
}

export function Callout({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-sunken)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-control)",
        padding: "var(--space-3) var(--space-4)",
        marginTop: "var(--space-4)",
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>{children}</div>
    </div>
  );
}

// ── Forward-looking layer (shared by every skill) ────────────────────────────
//
// The "predict the market" block, brand-safe: what the setup implies, a dated
// catalyst timeline (Barebone-style), the level to watch, and the base-rate
// edge. Lean colours follow the token rule — Pacific Blue = bullish,
// Coral = bearish, teal = pivotal/neutral.

function leanInk(lean: "bullish" | "bearish" | "pivotal"): string {
  return lean === "bullish" ? "var(--up-ink)" : lean === "bearish" ? "var(--down-ink)" : "var(--accent-hover)";
}
function leanDot(lean: "bullish" | "bearish" | "pivotal"): string {
  return lean === "bullish" ? "var(--up)" : lean === "bearish" ? "var(--down)" : "var(--accent)";
}
function leanGlyph(lean: "bullish" | "bearish" | "pivotal"): string {
  return lean === "bullish" ? "▲" : lean === "bearish" ? "▼" : "◆";
}

export function CatalystTimeline({
  catalysts,
}: {
  catalysts: import("@/lib/skillViewTypes").Catalyst[];
}) {
  if (!catalysts?.length) return null;
  return (
    <div style={{ position: "relative", marginTop: "var(--space-2)" }}>
      {/* the spine */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          left: 5,
          top: 6,
          bottom: 6,
          width: 2,
          background: "var(--border-strong)",
          borderRadius: 2,
        }}
      />
      {catalysts.map((c, i) => (
        <Reveal key={i} delay={80 + i * 70}>
          <div style={{ position: "relative", paddingLeft: 26, paddingBottom: i === catalysts.length - 1 ? 0 : "var(--space-4)" }}>
            <span
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 3,
                width: 12,
                height: 12,
                borderRadius: 999,
                background: "var(--bg-surface)",
                border: `2px solid ${leanDot(c.lean)}`,
              }}
            />
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", color: leanInk(c.lean) }}>
                {leanGlyph(c.lean)} {c.when}
              </span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", lineHeight: 1.4, marginTop: 1 }}>{c.event}</div>
            <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, marginTop: 2 }}>{c.soWhat}</div>
          </div>
        </Reveal>
      ))}
    </div>
  );
}

export function ForecastSection({ forecast }: { forecast?: Forecast }) {
  if (!forecast) return null;
  return (
    <Reveal delay={60}>
      <section
        style={{
          marginTop: "var(--space-4)",
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-card)",
          padding: "var(--space-6)",
          // A hairline teal edge marks this as the forward / predictive card.
          borderLeft: "3px solid var(--accent)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--accent-hover)",
            marginBottom: "var(--space-3)",
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M3 17l6-6 4 4 8-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M21 7v5h-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          What happens next
        </div>
        <p style={{ fontFamily: "var(--font-display)", fontSize: 19, lineHeight: 1.45, color: "var(--text)", margin: "0 0 var(--space-2)", letterSpacing: "-0.01em" }}>
          {forecast.setupImplies}
        </p>
        <p style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.55, margin: "0 0 var(--space-4)" }}>
          <strong style={{ color: "var(--text)" }}>Likeliest path:</strong> {forecast.likeliestPath}
        </p>

        <SectionLabel>The road ahead</SectionLabel>
        <CatalystTimeline catalysts={forecast.catalysts} />

        <div style={{ display: "flex", gap: "var(--space-3)", flexWrap: "wrap", marginTop: "var(--space-4)" }}>
          <div style={{ flex: 1, minWidth: 200, background: "var(--accent-weak)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--accent-hover)", marginBottom: 3 }}>The tell to watch</div>
            <div style={{ fontSize: 14, color: "var(--text)", lineHeight: 1.5 }}>{forecast.watchLevel}</div>
          </div>
          <div style={{ flex: 1, minWidth: 200, background: "var(--bg-sunken)", border: "1px solid var(--border)", borderRadius: "var(--radius-control)", padding: "var(--space-3) var(--space-4)" }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 3 }}>What history says</div>
            <div style={{ fontSize: 14, color: "var(--text-2)", lineHeight: 1.5 }}>{forecast.baseRate}</div>
          </div>
        </div>
      </section>
    </Reveal>
  );
}
