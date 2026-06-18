"use client";

// The History sheet — a per-user log of past Research runs. Tapping a row
// reopens that analysis from storage at ZERO cost (pure DB read, no pipeline,
// no Free deep slot spent). Mirrors the Skill Library sheet's look.
//
// Copy rules (CLAUDE.md): no machinery words in rendered text. Internal pipeline
// "kinds" (council/focused/…) are mapped to plain-English labels below.

import { useCallback, useEffect, useState } from "react";
import { Sheet } from "@/components/ui";
import { SkillIcon } from "./SkillLibrarySheet";

export interface HistoryListItem {
  id: string;
  kind: string;
  skillId: string | null;
  title: string;
  tickers: string[];
  createdAt: string;
}

// Internal pipeline kind → plain-English label (no banned vocabulary).
const KIND_LABEL: Record<string, string> = {
  council: "Deep dive",
  focused: "Quick take",
  compare: "Face-off",
  sector: "Sector pulse",
  headline: "Headline decode",
  allocator: "Starter plan",
  audit: "Health check",
  skillview: "Skill view",
  text: "Answer",
};

// Kind → a skill id, so every row gets a fitting icon even for free-text asks.
const KIND_ICON_SKILL: Record<string, string> = {
  council: "worth-owning",
  focused: "quick-take",
  compare: "face-off",
  sector: "sector-pulse",
  headline: "headline-decoder",
  allocator: "starter-portfolio",
  audit: "portfolio-health-check",
  skillview: "quick-take",
  text: "quick-take",
};

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!isFinite(then)) return "";
  const diff = Date.now() - then;
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day === 1) return "Yesterday";
  if (day < 7) return `${day}d ago`;
  return new Date(then).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

type HistorySheetProps = {
  open: boolean;
  onClose: () => void;
  /** Reopen a saved analysis by id (parent fetches the payload + renders). */
  onOpen: (id: string) => void;
};

export function HistorySheet({ open, onClose, onOpen }: HistorySheetProps) {
  const [items, setItems] = useState<HistoryListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setItems(null);
    try {
      const res = await fetch("/api/history");
      if (res.status === 401) {
        setError("Sign in to see your saved analyses.");
        setItems([]);
        return;
      }
      const data = await res.json().catch(() => null);
      setItems(Array.isArray(data?.items) ? (data.items as HistoryListItem[]) : []);
    } catch {
      setError("Couldn't load your history right now. Try again in a moment.");
      setItems([]);
    }
  }, []);

  // (Re)load every time the sheet opens.
  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const remove = useCallback(async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/history?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (res.ok) setItems((prev) => (prev ? prev.filter((i) => i.id !== id) : prev));
    } catch {
      /* leave the row in place; nothing to break */
    } finally {
      setDeleting(null);
    }
  }, []);

  return (
    <Sheet open={open} onClose={onClose} title="Your history">
      <p className="cvq-history-note">
        Every analysis you run is saved here. Reopen any of them anytime — it&apos;s
        free, and never counts against your monthly limit.
      </p>

      {items === null && !error && (
        <p className="cvq-skill-noresults">Loading your analyses…</p>
      )}

      {error && <p className="cvq-skill-noresults">{error}</p>}

      {items !== null && items.length === 0 && !error && (
        <p className="cvq-skill-noresults">
          Nothing here yet. Run an analysis and it&apos;ll show up — ready to reopen
          for free.
        </p>
      )}

      {items !== null && items.length > 0 && (
        <div className="cvq-skill-group">
          {items.map((item) => (
            <div key={item.id} className="cvq-history-row">
              <button
                type="button"
                className="cvq-history-open"
                onClick={() => onOpen(item.id)}
              >
                <SkillIcon id={item.skillId ?? KIND_ICON_SKILL[item.kind] ?? "quick-take"} />
                <span className="cvq-skill-text">
                  <span className="cvq-skill-name">{item.title}</span>
                  <span className="cvq-history-meta">
                    {KIND_LABEL[item.kind] ?? "Analysis"} · {relativeTime(item.createdAt)}
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="cvq-sheet-close cvq-history-del"
                aria-label={`Delete ${item.title}`}
                disabled={deleting === item.id}
                onClick={() => remove(item.id)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </Sheet>
  );
}
