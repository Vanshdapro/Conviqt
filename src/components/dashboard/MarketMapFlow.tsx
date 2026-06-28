"use client";

// The Map — "in motion": a full-screen chain-reaction playback of the market.
//
// Launched by the "See animation" button on the Dashboard map. The market core
// (the indices) ignites first, then a pulse travels each correlation edge to the
// next sector, which fires and re-emits to ITS neighbours — a chain reaction that
// cascades across the graph, narrated stage by stage: money draining from the
// laggards, flowing into the leaders, then what to watch.
//
// Brand rules (CLAUDE.md), same as the inline map:
//   • 2D <canvas> only. No WebGL / three.js / particles-as-art / parallax.
//   • LIGHT Almanac surface (warm paper). The motion is the drama, not a dark theme.
//   • Colours read ONCE from the :root tokens (no hex, no #000/#FFF).
//   • prefers-reduced-motion → no cascade: the fully-lit graph + captions, static.
//   • No new dependencies — a plain requestAnimationFrame timeline.
//   • Orientation, never alpha — captions describe rotation, never "buy".

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { MarketMap, MapEdge, MomentumTone } from "@/lib/map/types";

interface Palette {
  accent: string;
  up: string;
  down: string;
  text: string;
  textMuted: string;
  border: string;
  bg: string;
  surface: string;
}

// Settle (positions) — mirrors the inline map's force model, run silently once.
const REPULSION = 6400;
const SPRING = 0.02;
const SPRING_LEN = 170;
const GRAVITY = 0.0018;
const ANCHOR_PULL = 0.05;
const DAMPING = 0.86;
const SETTLE_STEPS = 520;

// Timeline (ms).
const STEP_MS = 440; // gap between consecutive ignitions
const INDEX_STAGGER = 90; // indices fire in quick succession at t=0
const PULSE_MS = STEP_MS; // time a pulse takes to travel an edge
const RIPPLE_MS = 760; // ignition ring lifetime
const END_HOLD = 1600; // pause on the fully-lit graph before "Replay" shows

function toneColor(tone: MomentumTone, pal: Palette): string {
  if (tone === "up") return pal.up;
  if (tone === "down") return pal.down;
  return pal.accent;
}
function arrowFor(tone: MomentumTone): string {
  return tone === "up" ? "▲" : tone === "down" ? "▼" : "•";
}
function fmtPct(pct: number | null): string {
  if (pct == null) return "—";
  const sign = pct > 0 ? "+" : pct < 0 ? "−" : "";
  return `${sign}${Math.abs(pct).toFixed(1)}%`;
}
function withAlpha(hex: string, alpha: number): string {
  const h = hex.trim().replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full || "000000", 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}
function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

// Internal layout/timeline node — never `any`.
interface FlowNode {
  id: string;
  ticker: string;
  label: string;
  kind: "index" | "sector" | "theme" | "stock" | "macro";
  tone: MomentumTone;
  ret: number | null; // horizon return, for the label
  weight: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  anchored: boolean;
  igniteAt: number; // ms into the timeline
}

export default function MarketMapFlow({
  map,
  onClose,
}: {
  map: MarketMap;
  onClose: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();

  const { data, narrative } = map;

  // Caption stage + "ended" cross from the rAF loop into React for the chrome.
  const [stage, setStage] = useState(0);
  const [ended, setEnded] = useState(false);
  const [runKey, setRunKey] = useState(0); // bumping replays the timeline

  // Caption copy, derived from the real data. Orientation only.
  const captions = useMemo(() => {
    const names = (arr: { label: string }[], n = 3) =>
      arr.slice(0, n).map((x) => x.label).join(", ");
    const laggards = names(data.laggards);
    const leaders = names(data.leaders);
    const out: { title: string; body: string }[] = [];
    out.push({
      title: narrative?.headline ?? "How the market moved",
      body:
        data.horizon === "1w"
          ? "Watch the last week play out — the market core, then the chain reaction across sectors."
          : data.horizon === "3m"
            ? "Watch the last three months play out across the market."
            : "Watch the last month play out — the market core, then the chain across sectors.",
    });
    out.push({
      title: "Where money drained",
      body: laggards
        ? `${laggards} cooled off${narrative?.laggardsNote ? ` — ${narrative.laggardsNote}` : "."}`
        : "No clear laggards this run.",
    });
    out.push({
      title: "Where money flowed",
      body: leaders
        ? `${leaders} drew capital in${narrative?.leadersNote ? ` — ${narrative.leadersNote}` : "."}`
        : "No clear leaders this run.",
    });
    out.push({
      title: "What to watch",
      body: narrative?.watch?.[0] ?? data.freshnessLabel,
    });
    return out;
  }, [data, narrative]);

  // Esc to close + body scroll lock + focus the close button.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  // The animation: build layout, settle, then play the chain reaction.
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const root = getComputedStyle(document.documentElement);
    const v = (name: string, fb: string) => (root.getPropertyValue(name).trim() || fb).trim();
    const pal: Palette = {
      accent: v("--accent", "#0E7978"),
      up: v("--up", "#0FA3B1"),
      down: v("--down", "#E3655B"),
      text: v("--text", "#2A1C15"),
      textMuted: v("--text-muted", "#7A6A5A"),
      border: v("--border", "#DED2B8"),
      bg: v("--bg-page", "#F5EFE1"),
      surface: v("--bg-surface", "#FCFAF5"),
    };

    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let W = wrap.clientWidth || 800;
    let H = wrap.clientHeight || 600;

    const retForHorizon = (n: { ret1wPct: number | null; ret1mPct: number | null; ret3mPct: number | null }) =>
      data.horizon === "1w" ? n.ret1wPct : data.horizon === "3m" ? n.ret3mPct : n.ret1mPct;

    // Bigger radii for the full-screen stage.
    const minR = Math.max(16, Math.min(W, H) * 0.022);
    const maxR = Math.max(40, Math.min(W, H) * 0.06);

    const nodes: FlowNode[] = data.nodes.map((n, i) => {
      const isIndex = n.kind === "index";
      const cx = W / 2;
      const cy = H / 2;
      const a = (i / Math.max(1, data.nodes.length)) * Math.PI * 2;
      const ring = Math.min(W, H) * (isIndex ? 0.05 : 0.34);
      return {
        id: n.id,
        ticker: n.ticker,
        label: n.label,
        kind: n.kind,
        tone: n.tone,
        ret: retForHorizon(n),
        weight: n.weight,
        x: cx + Math.cos(a) * ring,
        y: cy + Math.sin(a) * ring,
        vx: 0,
        vy: 0,
        r: Math.max(minR, Math.min(maxR, minR + n.weight * (maxR - minR) + (isIndex ? minR * 0.4 : 0))),
        anchored: isIndex,
        igniteAt: 0,
      };
    });
    const idIndex = new Map<string, number>();
    nodes.forEach((n, i) => idIndex.set(n.id, i));

    const edges: MapEdge[] = data.edges.filter((e) => idIndex.has(e.source) && idIndex.has(e.target));
    const adj = new Map<string, { id: string; weight: number }[]>();
    for (const n of nodes) adj.set(n.id, []);
    for (const e of edges) {
      adj.get(e.source)?.push({ id: e.target, weight: e.weight });
      adj.get(e.target)?.push({ id: e.source, weight: e.weight });
    }
    for (const list of adj.values()) list.sort((a, b) => b.weight - a.weight);

    // ── Settle positions with the force model (silent). ──────────────────────
    function settle() {
      const cx = W / 2;
      const cy = H / 2;
      for (let s = 0; s < SETTLE_STEPS; s++) {
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            let dx = a.x - b.x;
            let dy = a.y - b.y;
            let d2 = dx * dx + dy * dy;
            if (d2 < 0.01) {
              dx = (Math.random() - 0.5) * 0.5;
              dy = (Math.random() - 0.5) * 0.5;
              d2 = dx * dx + dy * dy + 0.01;
            }
            const d = Math.sqrt(d2);
            const minSep = a.r + b.r + 18;
            const force = REPULSION / d2 + (d < minSep ? (minSep - d) * 0.05 : 0);
            a.vx += (dx / d) * force;
            a.vy += (dy / d) * force;
            b.vx -= (dx / d) * force;
            b.vy -= (dy / d) * force;
          }
        }
        for (const e of edges) {
          const a = nodes[idIndex.get(e.source)!];
          const b = nodes[idIndex.get(e.target)!];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
          const k = SPRING * (0.4 + e.weight);
          const disp = d - SPRING_LEN;
          a.vx += (dx / d) * disp * k;
          a.vy += (dy / d) * disp * k;
          b.vx -= (dx / d) * disp * k;
          b.vy -= (dy / d) * disp * k;
        }
        for (const a of nodes) {
          a.vx += (cx - a.x) * GRAVITY;
          a.vy += (cy - a.y) * GRAVITY;
          if (a.anchored) {
            a.vx += (cx - a.x) * ANCHOR_PULL;
            a.vy += (cy - a.y) * ANCHOR_PULL;
          }
          a.vx *= DAMPING;
          a.vy *= DAMPING;
          a.x += a.vx;
          a.y += a.vy;
        }
      }
      // Fit the settled cloud to the viewport with padding.
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const n of nodes) {
        minX = Math.min(minX, n.x - n.r);
        minY = Math.min(minY, n.y - n.r);
        maxX = Math.max(maxX, n.x + n.r);
        maxY = Math.max(maxY, n.y + n.r);
      }
      const padX = W * 0.08;
      const padTop = H * 0.16; // leave room for the title bar
      const padBottom = H * 0.2; // and the caption bar
      const bw = Math.max(1, maxX - minX);
      const bh = Math.max(1, maxY - minY);
      const fit = Math.min((W - padX * 2) / bw, (H - padTop - padBottom) / bh);
      const ox = (W - bw * fit) / 2 - minX * fit;
      const oy = padTop - minY * fit;
      for (const n of nodes) {
        n.x = n.x * fit + ox;
        n.y = n.y * fit + oy;
        n.r = n.r * fit;
      }
    }

    // ── Ignition order: indices first, then BFS across correlation edges. ────
    function planTimeline() {
      const indices = nodes.filter((n) => n.kind === "index");
      const sectors = nodes.filter((n) => n.kind !== "index");
      indices.forEach((n, i) => (n.igniteAt = i * INDEX_STAGGER));
      let t = indices.length > 0 ? (indices.length - 1) * INDEX_STAGGER + STEP_MS : 0;

      // BFS seed = most-connected sector (ties → biggest |return|).
      const visited = new Set<string>();
      const order: FlowNode[] = [];
      const pool = [...sectors].sort((a, b) => {
        const da = (adj.get(a.id)?.length ?? 0);
        const db = (adj.get(b.id)?.length ?? 0);
        if (db !== da) return db - da;
        return Math.abs(b.ret ?? 0) - Math.abs(a.ret ?? 0);
      });
      for (const seed of pool) {
        if (visited.has(seed.id)) continue;
        const queue = [seed.id];
        visited.add(seed.id);
        while (queue.length) {
          const id = queue.shift()!;
          const nd = nodes[idIndex.get(id)!];
          if (nd.kind !== "index") order.push(nd);
          for (const nb of adj.get(id) ?? []) {
            if (!visited.has(nb.id)) {
              visited.add(nb.id);
              queue.push(nb.id);
            }
          }
        }
      }
      // Any sector with no edges that BFS still missed → append.
      for (const s of pool) if (!order.includes(s)) order.push(s);
      order.forEach((n, i) => (n.igniteAt = t + i * STEP_MS));
      t += order.length * STEP_MS;
      return t; // last ignition time
    }

    // Setting canvas.width CLEARS the backing store. So after every resize we
    // repaint the last frame — otherwise a resize/DPR change after the cascade
    // has settled (or a devtools capture) leaves a blank canvas with nothing to
    // redraw it.
    let lastNow = 0;
    let started = false;
    function resize() {
      W = wrap!.clientWidth || 800;
      H = wrap!.clientHeight || 600;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas!.width = Math.round(W * dpr);
      canvas!.height = Math.round(H * dpr);
      canvas!.style.width = `${W}px`;
      canvas!.style.height = `${H}px`;
      if (started) draw(lastNow);
    }

    resize();
    settle();
    const lastIgnite = planTimeline();
    const total = lastIgnite + RIPPLE_MS + END_HOLD;

    let raf = 0;
    let stopped = false;
    const start = performance.now();
    let lastStage = -1;

    function ignited(n: FlowNode, now: number) {
      return now >= n.igniteAt;
    }

    function draw(now: number) {
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx!.fillStyle = pal.bg;
      ctx!.fillRect(0, 0, W, H);

      // Edges — faint baseline; light up once their earlier endpoint has fired,
      // with a pulse dot travelling toward the later (not-yet-lit) endpoint.
      ctx!.lineCap = "round";
      for (const e of edges) {
        const a = nodes[idIndex.get(e.source)!];
        const b = nodes[idIndex.get(e.target)!];
        const earlier = a.igniteAt <= b.igniteAt ? a : b;
        const later = earlier === a ? b : a;
        const bothLit = ignited(a, now) && ignited(b, now);
        const baseAlpha = 0.06 + e.weight * 0.16;
        ctx!.strokeStyle = bothLit
          ? withAlpha(pal.accent, 0.18 + e.weight * 0.3)
          : withAlpha(pal.border, baseAlpha + 0.12);
        ctx!.lineWidth = 0.8 + e.weight * 2.6;
        ctx!.beginPath();
        ctx!.moveTo(a.x, a.y);
        ctx!.lineTo(b.x, b.y);
        ctx!.stroke();

        // Travelling pulse: from the moment `earlier` fires until `later` lights.
        const travel = (now - earlier.igniteAt) / PULSE_MS;
        if (travel >= 0 && travel <= 1 && later.igniteAt > earlier.igniteAt) {
          const tt = easeOutCubic(travel);
          const px = earlier.x + (later.x - earlier.x) * tt;
          const py = earlier.y + (later.y - earlier.y) * tt;
          const col = toneColor(later.tone, pal);
          ctx!.beginPath();
          ctx!.fillStyle = withAlpha(col, 0.9);
          ctx!.arc(px, py, 4 + e.weight * 3, 0, Math.PI * 2);
          ctx!.fill();
          ctx!.beginPath();
          ctx!.fillStyle = withAlpha(col, 0.18);
          ctx!.arc(px, py, 10 + e.weight * 5, 0, Math.PI * 2);
          ctx!.fill();
        }
      }

      // Nodes.
      for (const n of nodes) {
        const lit = ignited(n, now);
        const age = now - n.igniteAt;
        const col = toneColor(n.tone, pal);

        // Ignition ripple — an expanding ring in the first RIPPLE_MS after firing.
        if (lit && age < RIPPLE_MS) {
          const p = age / RIPPLE_MS;
          ctx!.beginPath();
          ctx!.strokeStyle = withAlpha(col, (1 - p) * 0.5);
          ctx!.lineWidth = 2.5 * (1 - p) + 0.5;
          ctx!.arc(n.x, n.y, n.r + p * (n.r * 2.2), 0, Math.PI * 2);
          ctx!.stroke();
        }

        // Pre-ignition: a dim ghost so the layout reads before the wave arrives.
        const bodyAlpha = lit ? (n.kind === "index" ? 0.92 : 0.82) : 0.1;
        // Glow halo on freshly-lit nodes.
        if (lit && age < RIPPLE_MS * 1.4) {
          const g = 1 - Math.min(1, age / (RIPPLE_MS * 1.4));
          ctx!.beginPath();
          ctx!.fillStyle = withAlpha(col, 0.22 * g);
          ctx!.arc(n.x, n.y, n.r + 14 * g, 0, Math.PI * 2);
          ctx!.fill();
        }

        ctx!.beginPath();
        ctx!.fillStyle = withAlpha(col, bodyAlpha);
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();

        ctx!.lineWidth = n.kind === "index" ? 2.6 : 1.6;
        ctx!.strokeStyle = withAlpha(n.kind === "index" ? pal.text : col, lit ? (n.kind === "index" ? 0.55 : 0.85) : 0.2);
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.stroke();

        if (lit) {
          ctx!.fillStyle = withAlpha(pal.text, 0.92);
          ctx!.font = `${Math.max(12, n.r * 0.7)}px ui-sans-serif, system-ui, sans-serif`;
          ctx!.textAlign = "center";
          ctx!.textBaseline = "middle";
          ctx!.fillText(arrowFor(n.tone), n.x, n.y);

          ctx!.font = "600 13px ui-sans-serif, system-ui, sans-serif";
          ctx!.textBaseline = "top";
          ctx!.fillStyle = withAlpha(pal.text, 0.92);
          ctx!.fillText(n.ticker, n.x, n.y + n.r + 6);
          ctx!.font = "400 11px ui-sans-serif, system-ui, sans-serif";
          ctx!.fillStyle = withAlpha(pal.textMuted, 0.95);
          ctx!.fillText(`${n.label} · ${fmtPct(n.ret)}`, n.x, n.y + n.r + 23);
        }
      }
    }

    function setStageFromTime(now: number) {
      // Map elapsed → caption stage across the ignition window.
      const p = lastIgnite > 0 ? now / lastIgnite : 1;
      const s = p < 0.18 ? 0 : p < 0.5 ? 1 : p < 0.85 ? 2 : 3;
      if (s !== lastStage) {
        lastStage = s;
        setStage(s);
      }
    }

    if (reduceMotion) {
      // No cascade: light everything, single frame, jump to the last caption.
      for (const n of nodes) n.igniteAt = -1;
      started = true;
      lastNow = total;
      draw(lastNow);
      setStage(captions.length - 1);
      setEnded(true);
      const ro0 = new ResizeObserver(() => resize()); // resize() repaints
      ro0.observe(wrap);
      return () => {
        stopped = true;
        ro0.disconnect();
      };
    }

    function frame(t: number) {
      if (stopped) return;
      const now = t - start;
      lastNow = now;
      setStageFromTime(now);
      draw(now);
      if (now >= total) {
        setEnded(true);
        return; // hold the final frame (resize() repaints it from lastNow)
      }
      raf = requestAnimationFrame(frame);
    }
    started = true;
    raf = requestAnimationFrame(frame);

    const ro = new ResizeObserver(() => {
      resize();
    });
    ro.observe(wrap);

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
    // runKey forces a fresh run on replay; data drives the layout.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, narrative, runKey, captions.length]);

  const cap = captions[Math.min(stage, captions.length - 1)];

  return (
    <div
      className="cvq-flow-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <div className="cvq-flow-topbar">
        <span id={titleId} className="cvq-flow-title">
          The Map — in motion
        </span>
        <button
          ref={closeRef}
          type="button"
          className="cvq-flow-close"
          onClick={onClose}
          aria-label="Close animation"
        >
          Close ✕
        </button>
      </div>

      <div ref={wrapRef} className="cvq-flow-stage">
        <canvas
          ref={canvasRef}
          className="cvq-flow-canvas"
          role="img"
          aria-label={`Animated chain reaction of how the market moved over the last ${
            data.horizon === "1w" ? "week" : data.horizon === "3m" ? "three months" : "month"
          }: the market core, then a pulse cascading across co-moving sectors.`}
        />
      </div>

      <div className="cvq-flow-caption" aria-live="polite">
        <div className="cvq-flow-caption-inner">
          <span className="cvq-flow-stagedots" aria-hidden="true">
            {captions.map((_, i) => (
              <span
                key={i}
                className={`cvq-flow-dot ${i <= stage ? "is-on" : ""}`}
              />
            ))}
          </span>
          <h2 className="cvq-flow-cap-title">{cap.title}</h2>
          <p className="cvq-flow-cap-body">{cap.body}</p>
          {ended && (
            <button
              type="button"
              className="cvq-flow-replay"
              onClick={() => {
                setEnded(false);
                setStage(0);
                setRunKey((k) => k + 1);
              }}
            >
              ↻ Replay
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
