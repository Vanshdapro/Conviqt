"use client";

// The Skill Library sheet (playbook 2.2/2.3): searchable, grouped by the
// playbook categories, each skill rendered as name + one-liner VERBATIM.
// Tapping a skill closes the sheet and arms that skill's guided input.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui";
import { groupSkills, searchSkills, type Skill } from "@/lib/skills";

// One small line-icon per skill, keyed by id. currentColor only — tokens rule.
const SKILL_ICONS: Record<string, ReactNode> = {
  "worth-owning": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 21s-7.5-4.6-9.5-9.2C1.1 8.4 3.2 5 6.6 5c2 0 3.6 1.1 4.4 2.7C12.8 6.1 14.4 5 16.4 5c3.4 0 5.5 3.4 4.1 6.8C18.5 16.4 12 21 12 21Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  "quick-take": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  ),
  "entry-exit-zones": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 17l5-5 4 3 7-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4 7h4M16 17h4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeDasharray="2 3" />
    </svg>
  ),
  "face-off": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M8 5v14M16 5v14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M5 8l3-3 3 3M13 16l3 3 3-3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "sector-pulse": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3 12h4l2.5-6 4 12 2.5-6h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "headline-decoder": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M7 9h10M7 13h6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16.5" cy="15.5" r="2" stroke="currentColor" strokeWidth="1.4" />
      <path d="m18 17 1.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  "crowd-check": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3.5 19c.6-3 2.9-4.5 5.5-4.5s4.9 1.5 5.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="17" cy="9.5" r="2.2" stroke="currentColor" strokeWidth="1.4" />
      <path d="M16 14.6c2.4.2 4 1.6 4.5 3.9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  ),
  "bull-bear-map": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4v16M12 8l6-3M12 8 6 5M12 16l6 3M12 16l-6 3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "starter-portfolio": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 3.5V12l6 4.2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
  "portfolio-health-check": (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M3.5 12h4l2-5 3.5 9 2.5-6h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 21s-7-4.3-8.9-8.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" opacity="0.45" />
    </svg>
  ),
};

export function SkillIcon({ id }: { id: string }) {
  return <span className="cvq-skill-ico">{SKILL_ICONS[id] ?? SKILL_ICONS["quick-take"]}</span>;
}

type SkillLibrarySheetProps = {
  open: boolean;
  onClose: () => void;
  onPick: (skill: Skill) => void;
};

export function SkillLibrarySheet({ open, onClose, onPick }: SkillLibrarySheetProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Fresh search every time the sheet opens.
  useEffect(() => {
    if (open) {
      setQuery("");
      // Sheet focuses its close button on open; move focus to search next tick.
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [open]);

  const groups = groupSkills(searchSkills(query));

  return (
    <Sheet open={open} onClose={onClose} title="Skills">
      <div className="cvq-skill-search">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
        </svg>
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search skills"
          aria-label="Search skills"
        />
      </div>

      {groups.length === 0 && (
        <p className="cvq-skill-noresults">Nothing matches that — try another word.</p>
      )}

      {groups.map(({ category, skills }) => (
        <div key={category} className="cvq-skill-group">
          <div className="cvq-skill-cat">{category}</div>
          {skills.map((skill) => (
            <button
              key={skill.id}
              type="button"
              className="cvq-skill-row"
              onClick={() => onPick(skill)}
            >
              <SkillIcon id={skill.id} />
              <span className="cvq-skill-text">
                <span className="cvq-skill-name">{skill.name}</span>
                <span className="cvq-skill-oneliner">{skill.oneLiner}</span>
              </span>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden className="cvq-skill-go">
                <path d="m9 6 6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ))}
        </div>
      ))}
    </Sheet>
  );
}
