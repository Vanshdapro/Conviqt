import type { PickerResult } from "@/lib/agents/picker";

function scopeFromAsOf(asOf: string): string {
  let h = 0;
  for (let i = 0; i < asOf.length; i++) {
    h = (h * 31 + asOf.charCodeAt(i)) >>> 0;
  }
  return `pk${h.toString(36)}`;
}

export default function PicksReport({
  result,
  onAnalyze,
}: {
  result: PickerResult;
  onAnalyze?: (ticker: string) => void;
}) {
  const scope = scopeFromAsOf(result.asOf);

  return (
    <article
      className="border border-rule rounded overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* Header */}
      <header
        className="border-b border-rule px-5 py-5 flex items-start justify-between gap-4"
        style={{ background: "var(--surface-2)" }}
      >
        <div>
          <div className="caps text-dim mb-2">Alpha scan</div>
          <p className="serif italic text-[20px] text-foreground/95 leading-snug max-w-xl">
            &ldquo;{result.regime}&rdquo;
          </p>
        </div>
        <div className="mono text-[11px] text-muted text-right flex-shrink-0">
          <div>
            {result.picks.length} pick{result.picks.length === 1 ? "" : "s"}
          </div>
          <div className="text-dim mt-0.5">${result.costUSD.toFixed(4)}</div>
        </div>
      </header>

      {/* Empty state */}
      {result.picks.length === 0 && (
        <section className="px-5 py-8">
          <p className="text-[14px] text-foreground/90 leading-relaxed">
            No setups met the bar.
          </p>
          {result.rationale && (
            <p className="text-[14px] text-muted leading-relaxed mt-3">
              {result.rationale}
            </p>
          )}
        </section>
      )}

      {/* Picks */}
      {result.picks.map((p) => (
        <section
          key={p.ticker}
          className="border-b border-rule last:border-b-0 px-5 py-5"
        >
          <div className="flex items-start justify-between gap-3 mb-3">
            <div className="flex items-baseline gap-2.5">
              <span className="text-[26px] font-semibold text-foreground tracking-tight leading-none">
                {p.ticker}
              </span>
              <span className="text-[13px] text-muted">{p.companyName}</span>
            </div>
            {onAnalyze && (
              <button
                onClick={() => onAnalyze(p.ticker)}
                className="flex-shrink-0 mono text-[11px] text-muted hover:text-foreground border border-rule rounded px-3 py-1.5 transition-colors hover:border-foreground/30"
                style={{ background: "var(--surface-2)" }}
              >
                Run Council →
              </button>
            )}
          </div>
          <p className="text-[14px] text-foreground/85 leading-relaxed mb-3">
            {p.thesis}
          </p>
          <div className="flex flex-wrap items-center gap-1.5">
            {p.sourceIndexes.map((i) => (
              <a
                key={i}
                href={`#${scope}-src-${i}`}
                className="mono text-[10px] text-muted hover:text-foreground border border-rule rounded-full px-2 py-0.5 transition-colors"
              >
                #{i}
              </a>
            ))}
          </div>
        </section>
      ))}

      {/* Sources */}
      <section
        className="px-5 py-4 border-t border-rule"
        style={{ background: "var(--surface-2)" }}
      >
        <div className="caps text-dim mb-3">Sources</div>
        <ol className="space-y-1.5">
          {result.sources.map((s, i) => (
            <li
              key={i}
              id={`${scope}-src-${i}`}
              className="flex gap-2 text-[12px] text-muted leading-relaxed"
            >
              <span className="mono text-dim flex-shrink-0 w-5">#{i}</span>
              <a
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline underline-offset-2 decoration-rule"
              >
                {s.title}
              </a>
              <span className="text-dim flex-shrink-0">· {s.publisher}</span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
