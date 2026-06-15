// Academic citation generator — APA 7, Harvard, Chicago (notes-bibliography).
//
// Master's students lose hours formatting bibliographies. The Thesis Hub turns
// any Conviqt analysis into a clean, copy-paste reference. Pure, deterministic
// string formatting — no deps, fully testable. Data vintage (snapshot dates) is
// carried into the reference so a citation pins the exact, reproducible data.

export type CitationStyle = "apa" | "harvard" | "chicago";

export const CITATION_STYLES: { id: CitationStyle; label: string }[] = [
  { id: "apa", label: "APA 7" },
  { id: "harvard", label: "Harvard" },
  { id: "chicago", label: "Chicago" },
];

export interface CitationMeta {
  authors: string; // "Conviqt for Academia"
  year: number;
  title: string; // analysis title, e.g. "Macro-factor sensitivity model: AAPL"
  url: string;
  dataSources: string[]; // provenance lines (vendor + snapshot date)
  accessed: string; // human date, e.g. "15 June 2026"
}

function sourcesNote(sources: string[]): string {
  if (!sources.length) return "";
  return ` Data: ${sources.join("; ")}.`;
}

// Format one reference in the chosen style. The trailing data-provenance note is
// appended in every style — academic data citations should disclose the source
// and its vintage, which is also what makes the result reproducible.
export function formatCitation(style: CitationStyle, m: CitationMeta): string {
  const title = m.title.trim();
  switch (style) {
    case "apa":
      // Author. (Year). Title [Data set]. Publisher. URL
      return `${m.authors}. (${m.year}). ${title} [Data set]. ${m.authors}. ${m.url}.${sourcesNote(m.dataSources)}`;
    case "harvard":
      // Author (Year) Title. Available at: URL (Accessed: date).
      return `${m.authors} (${m.year}) ${title}. Available at: ${m.url} (Accessed: ${m.accessed}).${sourcesNote(m.dataSources)}`;
    case "chicago":
      // Author. "Title." Accessed date. URL.
      return `${m.authors}. "${title}." Accessed ${m.accessed}. ${m.url}.${sourcesNote(m.dataSources)}`;
    default:
      return `${m.authors}. ${title}. ${m.url}.`;
  }
}

// Format a JS date as "15 June 2026" (locale-independent, deterministic).
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export function humanDate(d: Date): string {
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
