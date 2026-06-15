// Thesis Hub — P6. Stubbed so the nav doesn't 404 while the clean CSV export
// and APA/Harvard/Chicago citation generator are built next.

export const metadata = { title: "Thesis Hub" };

export default function ThesisPage() {
  return (
    <div className="edu-stub">
      <span className="edu-kicker">Citation-ready</span>
      <h1>Thesis Hub</h1>
      <p>
        One click for a clean CSV of any analysis. One click for a formatted
        APA, Harvard, or Chicago citation — straight to your clipboard.
      </p>
      <p className="edu-stub-status">
        In development — export and the citation generator land in the next
        build. Every export will draw only from public-domain data.
      </p>
    </div>
  );
}
