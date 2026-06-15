// Market Wedge Finder — P5. Stubbed so the nav doesn't 404 while the
// fundamental-vs-market engine (DCF over SEC EDGAR + distortion classifier) is
// built next.

export const metadata = { title: "Market Wedge Finder" };

export default function WedgePage() {
  return (
    <div className="edu-stub">
      <span className="edu-kicker">Distortion analysis</span>
      <h1>Market Wedge Finder</h1>
      <p>
        Search a ticker or sector to see fundamental value against the actual
        market price, the gap shaded, and the distortion named and sourced.
      </p>
      <p className="edu-stub-status">
        In development — the deterministic DCF engine (SEC EDGAR fundamentals)
        and distortion classifier land in the next build.
      </p>
    </div>
  );
}
