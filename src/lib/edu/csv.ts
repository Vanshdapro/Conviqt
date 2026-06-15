// Clean CSV builder — zero deps, RFC-4180 quoting. The Thesis Hub promise is
// "perfectly structured rows, no cell cleaning", so escaping has to be correct:
// fields containing a comma, quote, or newline are wrapped in double quotes with
// inner quotes doubled.

export type CsvCell = string | number | null | undefined;

function escapeCell(cell: CsvCell): string {
  if (cell == null) return "";
  const s = String(cell);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// Build a CSV string from a header row and data rows. Uses CRLF line endings
// (the RFC-4180 default Excel expects).
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(escapeCell).join(",")];
  for (const row of rows) lines.push(row.map(escapeCell).join(","));
  return lines.join("\r\n");
}
