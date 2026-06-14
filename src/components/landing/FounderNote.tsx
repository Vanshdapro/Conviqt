// Team note (landing Phase 6, section 7).
//
// Founder call (2026-06-14): no personal photo and no first-person founder
// story — this speaks in the team's voice ("From the team" / "Why we built
// this"). The message is the thesis behind Conviqt: a retail investor who wants
// to actually get good at this shouldn't have to live across a dozen platforms
// — one for headlines, one for picks, somewhere else to learn, a spreadsheet to
// track it all. Conviqt is the one place that does the whole job.
//
// Pure static copy, server component, tokens only (styling: cvq-team-note in
// app.css). The component name stays FounderNote so page.tsx's import is
// unchanged; it renders the team note.

// The standing promise — the one line of this section that is non-negotiable
// and already true, kept from the founder workstream.
const PROMISE = "Every pick we make is public — including the ones that go wrong.";

export function FounderNote() {
  return (
    <section className="cvq-land-section" aria-labelledby="team-h" data-thread-node data-thread-label="Team">
      <p className="cvq-land-eyebrow" data-reveal="up">From the team</p>
      <h2 id="team-h" className="cvq-land-h2" data-reveal="clip">
        Why we built this
      </h2>
      <div className="cvq-team-note" data-reveal="up">
        <p>
          We built Conviqt because getting good at investing shouldn&rsquo;t mean living across a
          dozen tabs. If you actually want to do this well today, you bounce between one site for
          headlines, another for stock picks, a video to learn the basics, and a spreadsheet to keep
          track of it all &mdash; and none of them talk to each other.
        </p>
        <p>
          We wanted one place that does the whole job. Ask about any stock and get a plain-English
          answer. Read the headlines that move the market and what they mean for you. See a public
          track record we can&rsquo;t quietly edit. Learn the why behind every number as you go.
          That&rsquo;s Conviqt &mdash; the all-in-one tool for retail investors we wished existed
          when we started.
        </p>
        <p className="cvq-founder-promise">{PROMISE}</p>
        <p className="cvq-founder-name">&mdash; The Conviqt team</p>
      </div>
    </section>
  );
}
