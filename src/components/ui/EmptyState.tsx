import type { ReactNode } from "react";

type EmptyStateProps = {
  title: string;
  body?: ReactNode;
  /** defaults to a neutral document glyph */
  icon?: ReactNode;
  /** a CTA — typically a <button className="cvq-btn ..."> or a link */
  action?: ReactNode;
};

const DefaultIcon = (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
    <path
      d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinejoin="round"
    />
    <path d="M14 3v5h5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
  </svg>
);

/**
 * EmptyState — the honest "nothing here yet / data unavailable" surface.
 * Brand rule: never fake data; say so plainly and offer the next action.
 */
export function EmptyState({ title, body, icon, action }: EmptyStateProps) {
  return (
    <div className="cvq-empty" role="status">
      <span className="cvq-empty-ico">{icon ?? DefaultIcon}</span>
      <span className="cvq-empty-title">{title}</span>
      {body && <span className="cvq-empty-body">{body}</span>}
      {action && <span style={{ marginTop: "var(--space-2)" }}>{action}</span>}
    </div>
  );
}
