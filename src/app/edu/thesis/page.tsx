"use client";

import { useMemo, useState } from "react";
import {
  DEMO_ASSETS,
  getAsset,
  PRICES_AS_OF,
  PRICES_SOURCE,
} from "@/lib/edu/data/prices";
import { getFundamentals, FUNDAMENTALS_AS_OF, FUNDAMENTALS_SOURCE } from "@/lib/edu/data/fundamentals";
import { fitFactorModel } from "@/lib/edu/factorModel";
import { computeDcf, defaultAssumptions, fairValuePath } from "@/lib/edu/dcf";
import { MACRO_LABELS, MacroFactor } from "@/lib/edu/data/macro";
import { toCsv, type CsvCell } from "@/lib/edu/csv";
import {
  formatCitation,
  humanDate,
  CITATION_STYLES,
  type CitationStyle,
  type CitationMeta,
} from "@/lib/edu/citation";

type DatasetId = "price" | "wedge" | "factor";

const DATASETS: { id: DatasetId; label: string }[] = [
  { id: "price", label: "Monthly price history" },
  { id: "wedge", label: "Wedge: price vs fundamental" },
  { id: "factor", label: "Macro-factor sensitivities" },
];

interface BuiltDataset {
  headers: string[];
  rows: CsvCell[][];
  title: string;
  sources: string[];
  available: boolean;
  unavailableReason?: string;
}

export default function ThesisPage() {
  const [ticker, setTicker] = useState("AAPL");
  const [dataset, setDataset] = useState<DatasetId>("price");
  const [style, setStyle] = useState<CitationStyle>("apa");
  const [copied, setCopied] = useState(false);

  const asset = getAsset(ticker);
  const fundamentals = getFundamentals(ticker);

  const built = useMemo<BuiltDataset>(() => {
    if (!asset) {
      return { headers: [], rows: [], title: "", sources: [], available: false, unavailableReason: "No data for this asset." };
    }
    if (dataset === "price") {
      return {
        headers: ["Month", "Close (USD)"],
        rows: asset.points.map((p) => [p.date, p.close]),
        title: `${asset.name} — monthly price history`,
        sources: [`${PRICES_SOURCE} snapshot ${PRICES_AS_OF}`],
        available: true,
      };
    }
    if (dataset === "factor") {
      const m = fitFactorModel(asset);
      const factors: MacroFactor[] = ["rate", "inflation", "tax"];
      const rows: CsvCell[][] = factors.map((f) => [
        MACRO_LABELS[f],
        m.betas[f].toFixed(6),
        (m.betas[f] * 12 * 100).toFixed(2),
      ]);
      rows.push(["Intercept (alpha, monthly)", m.alpha.toFixed(6), ""]);
      rows.push(["In-sample R squared", m.rSquared.toFixed(4), ""]);
      rows.push(["Observations (months)", m.nObs, ""]);
      return {
        headers: ["Factor", "Beta (monthly log-return per +1pp)", "Annualized sensitivity (%)"],
        rows,
        title: `${asset.name} — macro-factor sensitivities (OLS)`,
        sources: [`${PRICES_SOURCE} snapshot ${PRICES_AS_OF}`, "Macro: public-domain (Federal Reserve / BLS / US statutory rate)"],
        available: true,
      };
    }
    // wedge
    if (!fundamentals) {
      return { headers: [], rows: [], title: "", sources: [], available: false, unavailableReason: "No fundamentals for this asset." };
    }
    const a = defaultAssumptions(fundamentals);
    const dcf = computeDcf(fundamentals, a);
    if (!dcf.valid) {
      return { headers: [], rows: [], title: "", sources: [], available: false, unavailableReason: dcf.reason };
    }
    const fair = fairValuePath(dcf.intrinsicPerShare, asset.points, a.terminalGrowth);
    const rows: CsvCell[][] = asset.points.map((p, i) => {
      const fv = fair[i].close;
      const wedgePct = fv > 0 ? ((p.close - fv) / fv) * 100 : 0;
      return [p.date, p.close, fv, wedgePct.toFixed(1)];
    });
    return {
      headers: ["Month", "Market Price (USD)", "Fundamental Value (USD)", "Wedge (%)"],
      rows,
      title: `${asset.name} — fundamental-vs-market wedge (DCF)`,
      sources: [
        `${FUNDAMENTALS_SOURCE} snapshot ${FUNDAMENTALS_AS_OF}`,
        `${PRICES_SOURCE} snapshot ${PRICES_AS_OF}`,
      ],
      available: true,
    };
  }, [asset, fundamentals, dataset]);

  const citation = useMemo<string>(() => {
    const meta: CitationMeta = {
      authors: "Conviqt for Academia",
      year: new Date().getUTCFullYear(),
      title: built.title || `${asset?.name ?? ticker} — Conviqt analysis`,
      url: "https://edu.conviqt.com/thesis",
      dataSources: built.sources,
      accessed: humanDate(new Date()),
    };
    return formatCitation(style, meta);
  }, [built, style, asset, ticker]);

  const downloadCsv = () => {
    const csv = toCsv(built.headers, built.rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conviqt_${ticker}_${dataset}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const copyCitation = async () => {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  const preview = built.rows.slice(0, 12);

  return (
    <div className="sbx">
      <header className="sbx-head">
        <h1>Thesis Hub</h1>
        <p>
          Clean, assignment-ready data and a formatted citation — one click each.
          Everything here draws only from public-domain sources.
        </p>
      </header>

      <div className="sbx-grid">
        <section className="sbx-controls" aria-label="Export controls">
          <label className="sbx-field">
            <span className="sbx-field-label">Asset</span>
            <select value={ticker} onChange={(e) => setTicker(e.target.value)}>
              {DEMO_ASSETS.map((d) => (
                <option key={d.ticker} value={d.ticker}>
                  {d.ticker} — {d.name}
                </option>
              ))}
            </select>
          </label>

          <label className="sbx-field">
            <span className="sbx-field-label">Dataset</span>
            <select value={dataset} onChange={(e) => setDataset(e.target.value as DatasetId)}>
              {DATASETS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="ths-download"
            onClick={downloadCsv}
            disabled={!built.available}
          >
            ↓ Download clean CSV
          </button>

          <label className="sbx-field">
            <span className="sbx-field-label">Citation style</span>
            <select value={style} onChange={(e) => setStyle(e.target.value as CitationStyle)}>
              {CITATION_STYLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="sbx-output">
          {built.available ? (
            <>
              <div className="ths-tablewrap">
                <table className="ths-table">
                  <thead>
                    <tr>
                      {built.headers.map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i}>
                        {row.map((cell, j) => (
                          <td key={j}>{cell as React.ReactNode}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {built.rows.length > preview.length && (
                <p className="sbx-note ths-more">
                  Preview of {preview.length} of {built.rows.length} rows — the
                  CSV contains all {built.rows.length}.
                </p>
              )}

              <div className="ths-cite">
                <div className="ths-cite-head">
                  <span className="sbx-field-label">Citation</span>
                  <button type="button" className="ths-copy" onClick={copyCitation}>
                    {copied ? "Copied ✓" : "Copy citation"}
                  </button>
                </div>
                <p className="ths-cite-text">{citation}</p>
              </div>
            </>
          ) : (
            <p className="sbx-invalid">{built.unavailableReason}</p>
          )}
        </section>
      </div>
    </div>
  );
}
