"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DEMO_ASSETS, getAsset, PRICES_AS_OF, PRICES_SOURCE } from "@/lib/edu/data/prices";
import {
  MACRO_BASELINE,
  MACRO_LABELS,
  MACRO_RANGE,
  MacroFactor,
  type MacroVector,
} from "@/lib/edu/data/macro";
import {
  fitFactorModel,
  counterfactualPath,
  effectBullets,
  appliedEffect,
  ANNUAL_EFFECT_CAP,
} from "@/lib/edu/factorModel";
import type { PricePoint } from "@/lib/edu/data/prices";

const FACTORS: MacroFactor[] = ["rate", "inflation", "tax"];

export default function SandboxPage() {
  const [ticker, setTicker] = useState(DEMO_ASSETS[0].ticker);
  const [scenario, setScenario] = useState<MacroVector>({ ...MACRO_BASELINE });

  const asset = getAsset(ticker)!;
  const model = useMemo(() => fitFactorModel(asset), [asset]);
  const actual = asset.points;
  const counterfactual = useMemo(
    () => counterfactualPath(asset, model, scenario),
    [asset, model, scenario]
  );
  const bullets = useMemo(() => effectBullets(model, scenario), [model, scenario]);
  const eff = useMemo(() => appliedEffect(model, scenario), [model, scenario]);

  const atBaseline = FACTORS.every((f) => scenario[f] === MACRO_BASELINE[f]);

  return (
    <div className="sbx">
      <header className="sbx-head">
        <h1>Research Sandbox</h1>
        <p>
          Drag the macro sliders. A deterministic regression reshapes{" "}
          {asset.name}&apos;s real 10-year path into your scenario — no coding, no
          prompting.
        </p>
      </header>

      <div className="sbx-grid">
        {/* ── Controls ─────────────────────────────────────────────── */}
        <section className="sbx-controls" aria-label="Scenario controls">
          <label className="sbx-field">
            <span className="sbx-field-label">Asset</span>
            <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {DEMO_ASSETS.map((a) => (
                <option key={a.ticker} value={a.ticker}>
                  {a.ticker} — {a.name}
                </option>
              ))}
            </select>
            <span className="sbx-note">{asset.note}</span>
          </label>

          {FACTORS.map((f) => {
            const range = MACRO_RANGE[f];
            return (
              <label className="sbx-field" key={f}>
                <span className="sbx-field-label">
                  {MACRO_LABELS[f]}
                  <strong>{scenario[f]}%</strong>
                </span>
                <input
                  type="range"
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  value={scenario[f]}
                  onChange={(e) =>
                    setScenario((s) => ({ ...s, [f]: Number(e.target.value) }))
                  }
                />
                <span className="sbx-note">
                  today: {MACRO_BASELINE[f]}%
                </span>
              </label>
            );
          })}

          <button
            type="button"
            className="sbx-reset"
            onClick={() => setScenario({ ...MACRO_BASELINE })}
            disabled={atBaseline}
          >
            Reset to today&apos;s regime
          </button>
        </section>

        {/* ── Chart + explanation ──────────────────────────────────── */}
        <section className="sbx-output">
          <SandboxChart actual={actual} counterfactual={counterfactual} />

          <div className="sbx-legend">
            <span>
              <i className="sbx-swatch sbx-swatch-actual" /> Actual price
            </span>
            <span>
              <i className="sbx-swatch sbx-swatch-cf" /> Your scenario
            </span>
            {!atBaseline && (
              <span className="sbx-applied">
                net modelled effect{" "}
                <strong>
                  {eff.totalAnnual >= 0 ? "+" : ""}
                  {(eff.totalAnnual * 100).toFixed(1)}%/yr
                </strong>
                {eff.capped && " (capped)"}
              </span>
            )}
          </div>

          <ul className="sbx-bullets">
            {bullets.map((b) => (
              <li key={b.factor}>{b.text}</li>
            ))}
          </ul>

          <p className="sbx-method">
            <strong>How this is computed:</strong> ordinary least-squares
            regression of {asset.name}&apos;s monthly log returns on the
            prevailing interest-rate, inflation, and corporate-tax regime
            (in-sample R² = {(model.rSquared * 100).toFixed(0)}%, n ={" "}
            {model.nObs}). The scenario applies a constant return drift vs
            today&apos;s regime, capped at ±{(ANNUAL_EFFECT_CAP * 100).toFixed(0)}
            %/yr for legibility. This is an illustrative sensitivity, not a
            forecast. Prices: {PRICES_SOURCE}, snapshot {PRICES_AS_OF}. Macro:
            public-domain (Federal Reserve / BLS / US statutory rate).
          </p>
        </section>
      </div>
    </div>
  );
}

// ── Zero-dependency canvas chart ──────────────────────────────────────────
// Two overlaid line series, autoscaled to fit both. Colours are read from the
// Almanac CSS tokens at draw time so no hex is hardcoded in the component.
function SandboxChart({
  actual,
  counterfactual,
}: {
  actual: PricePoint[];
  counterfactual: PricePoint[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const wrap = canvas.parentElement;
    if (!wrap) return;

    const cssW = wrap.clientWidth;
    const cssH = 340;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = cssW * dpr;
    canvas.height = cssH * dpr;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${cssH}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, cssW, cssH);

    const css = getComputedStyle(document.documentElement);
    const col = (name: string) => css.getPropertyValue(name).trim();
    const inkActual = col("--text-2") || "#63372C";
    const inkCf = col("--accent") || "#0E7978";
    const grid = col("--border") || "#DED2B8";
    const axis = col("--text-muted") || "#7A6A5A";

    const padL = 52;
    const padR = 12;
    const padT = 14;
    const padB = 26;
    const plotW = cssW - padL - padR;
    const plotH = cssH - padT - padB;

    const all = [...actual, ...counterfactual];
    if (all.length === 0) return;
    let lo = Infinity;
    let hi = -Infinity;
    for (const p of all) {
      if (p.close < lo) lo = p.close;
      if (p.close > hi) hi = p.close;
    }
    const padV = (hi - lo) * 0.08 || 1;
    lo = Math.max(0, lo - padV);
    hi = hi + padV;

    const n = Math.max(actual.length, counterfactual.length);
    const x = (i: number) => padL + (n <= 1 ? 0 : (i / (n - 1)) * plotW);
    const y = (v: number) => padT + plotH - ((v - lo) / (hi - lo || 1)) * plotH;

    // Gridlines + y labels (4 ticks).
    ctx.font = "11px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = axis;
    ctx.strokeStyle = grid;
    ctx.lineWidth = 1;
    for (let t = 0; t <= 4; t++) {
      const v = lo + ((hi - lo) * t) / 4;
      const yy = y(v);
      ctx.beginPath();
      ctx.moveTo(padL, yy);
      ctx.lineTo(cssW - padR, yy);
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillText(`$${v.toFixed(0)}`, 8, yy + 3);
    }

    // x end labels.
    if (actual.length > 1) {
      ctx.fillText(actual[0].date, padL, cssH - 8);
      const last = actual[actual.length - 1].date;
      const w = ctx.measureText(last).width;
      ctx.fillText(last, cssW - padR - w, cssH - 8);
    }

    const drawLine = (series: PricePoint[], color: string, width: number) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineJoin = "round";
      series.forEach((p, i) => {
        const px = x(i);
        const py = y(p.close);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    };

    drawLine(actual, inkActual, 1.75);
    drawLine(counterfactual, inkCf, 2.25);
  }, [actual, counterfactual]);

  return (
    <div className="sbx-chart">
      <canvas ref={ref} />
    </div>
  );
}
