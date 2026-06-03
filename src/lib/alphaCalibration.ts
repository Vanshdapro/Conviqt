// Calibration — the self-scoring track record behind the risk numbers.
//
// Every pick now ships a confidence_pct ("we think there is an X% chance this
// reaches target within the horizon"). A forecast is only as trustworthy as its
// track record, so when predictions resolve (target / stop / fundamental exit /
// horizon expiry) we grade them and aggregate here: hit rate, a per-confidence
// calibration table (predicted vs. actual), and a Brier score (how well the
// stated probabilities matched reality). This is the engine that earns the
// right to lift MAX_PUBLISHABLE_CONFIDENCE over time — and the purest
// expression of "transparency, not alpha".

import {
  MAX_PUBLISHABLE_CONFIDENCE,
  type AlphaPick,
  type CalibrationBucket,
  type CalibrationStats,
} from "./alphaTypes";

// Confidence bands for the calibration table. A prediction lands in the band
// containing its confidence_pct (top band is inclusive of 100).
const BANDS: Array<{ label: string; lo: number; hi: number }> = [
  { label: "50–60%", lo: 50, hi: 60 },
  { label: "60–70%", lo: 60, hi: 70 },
  { label: "70–80%", lo: 70, hi: 80 },
  { label: "80–90%", lo: 80, hi: 90 },
  { label: "90–100%", lo: 90, hi: 100 },
];

const round1 = (n: number) => Math.round(n * 10) / 10;

// A pick counts toward calibration only if it resolved AND carried a forecast
// (confidence + a graded outcome). Picks from before the prediction engine, or
// still open, are excluded.
function isGraded(p: AlphaPick): boolean {
  return (
    p.resolved === true &&
    typeof p.confidence_pct === "number" &&
    typeof p.prediction_correct === "boolean"
  );
}

export function computeCalibration(resolved: AlphaPick[]): CalibrationStats {
  const graded = resolved.filter(isGraded);
  const n = graded.length;

  const empty: CalibrationStats = {
    resolved: 0,
    hitRate: 0,
    avgConfidence: 0,
    brier: 0,
    avgRealizedReturnPct: 0,
    buckets: [],
    maxPublishableConfidence: MAX_PUBLISHABLE_CONFIDENCE,
  };
  if (n === 0) return empty;

  let hits = 0;
  let confSum = 0;
  let brierSum = 0;
  let retSum = 0;
  let retCount = 0;
  for (const p of graded) {
    const conf = p.confidence_pct as number;
    const correct = p.prediction_correct ? 1 : 0;
    hits += correct;
    confSum += conf;
    brierSum += Math.pow(conf / 100 - correct, 2);
    if (typeof p.realized_return_pct === "number") {
      retSum += p.realized_return_pct;
      retCount += 1;
    }
  }

  const buckets: CalibrationBucket[] = [];
  for (const band of BANDS) {
    const inBand = graded.filter((p) => {
      const c = p.confidence_pct as number;
      return c >= band.lo && (band.hi >= 100 ? c <= 100 : c < band.hi);
    });
    if (inBand.length === 0) continue;
    const predicted =
      inBand.reduce((a, p) => a + (p.confidence_pct as number), 0) / inBand.length;
    const actual =
      (inBand.filter((p) => p.prediction_correct).length / inBand.length) * 100;
    buckets.push({
      label: band.label,
      lo: band.lo,
      hi: band.hi,
      n: inBand.length,
      predicted: round1(predicted),
      actual: round1(actual),
    });
  }

  return {
    resolved: n,
    hitRate: round1((hits / n) * 100),
    avgConfidence: round1(confSum / n),
    brier: Math.round((brierSum / n) * 1000) / 1000, // 0 = perfectly calibrated
    avgRealizedReturnPct: retCount > 0 ? round1(retSum / retCount) : 0,
    buckets,
    maxPublishableConfidence: MAX_PUBLISHABLE_CONFIDENCE,
  };
}
