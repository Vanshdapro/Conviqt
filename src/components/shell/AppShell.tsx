"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

// ── Navigation model: the five surfaces, in order (playbook 2.2) ────────────
type NavKey = "research" | "dashboard" | "headlines" | "portfolio" | "academy";

type NavItem = {
  key: NavKey;
  label: string;
  href: string;
  icon: ReactNode;
  /** path prefixes that light this item up as active */
  match: string[];
};

const ICON = {
  research: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  dashboard: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.6" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  ),
  headlines: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 8h7M7 12h10M7 16h6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  portfolio: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M4 19V9m5 10V5m5 14v-7m5 7V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
  academy: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 4 2.5 9 12 14l9.5-5L12 4Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M6.5 11.5V16c0 1.1 2.46 2.5 5.5 2.5s5.5-1.4 5.5-2.5v-4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  ),
} as const;

const NAV: NavItem[] = [
  { key: "research", label: "Research", href: "/research", icon: ICON.research, match: ["/research", "/chat", "/stock", "/alpha", "/cdi", "/watchlist"] },
  { key: "dashboard", label: "Dashboard", href: "/dashboard", icon: ICON.dashboard, match: ["/dashboard"] },
  { key: "headlines", label: "Headlines", href: "/headlines", icon: ICON.headlines, match: ["/headlines"] },
  { key: "portfolio", label: "Portfolio", href: "/portfolio", icon: ICON.portfolio, match: ["/portfolio"] },
  { key: "academy", label: "Academy", href: "/academy", icon: ICON.academy, match: ["/academy"] },
];

// Path prefixes where the logged-in shell appears. Public + marketing + auth
// pages (/, /login, /signup, /pricing, /about, /developers, /newsletter,
// /methodology, /admin, /auth) render with NO shell. /dev hosts the kitchen sink.
const SHELL_PREFIXES = [
  "/research", "/dashboard", "/headlines", "/portfolio", "/academy",
  "/chat", "/stock", "/alpha", "/cdi", "/watchlist", "/dev",
];

function activeKey(pathname: string): NavKey | null {
  for (const item of NAV) {
    if (item.match.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return item.key;
  }
  return null;
}

function showsShell(pathname: string): boolean {
  return SHELL_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

const Wordmark = () => (
  <span data-no-translate>
    CONVI<span className="cvq-wordmark-tick">Q</span>T
  </span>
);

// ── Account menu ────────────────────────────────────────────────────────────
function planLabel(plan: string | null): string {
  if (!plan || plan === "free") return "Free";
  return "Pro";
}

function AccountMenu() {
  const [email, setEmail] = useState<string | null>(null);
  const [plan, setPlan] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/credits")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!alive) return;
        // We read identity/plan only — credit numbers are never shown (subscription brand).
        if (d && (typeof d.credits === "number" || typeof d.email === "string")) {
          setEmail(typeof d.email === "string" ? d.email : null);
          setPlan(typeof d.plan === "string" ? d.plan : "free");
        }
      })
      .catch(() => null)
      .finally(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Before the identity resolves, show a quiet placeholder (no "Free plan"
  // flash for logged-out users, no layout shift in the sidebar foot).
  if (!loaded) {
    return (
      <div className="cvq-account" aria-hidden>
        <div className="cvq-account-trigger" style={{ pointerEvents: "none" }}>
          <span className="cvq-skeleton" style={{ width: 30, height: 30, borderRadius: "var(--radius-pill)" }} />
          <span className="cvq-skeleton" style={{ height: 12, flex: 1, borderRadius: "var(--radius-control)" }} />
        </div>
      </div>
    );
  }

  // Logged out → a single Sign in affordance.
  if (email === null && plan === null) {
    return (
      <Link href="/login" className="cvq-btn cvq-btn--secondary" style={{ width: "100%" }}>
        Sign in
      </Link>
    );
  }

  const initial = (email?.trim()?.[0] ?? "C").toUpperCase();
  const label = planLabel(plan);

  return (
    <div className="cvq-account" ref={rootRef}>
      <button
        type="button"
        className="cvq-account-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="cvq-avatar" aria-hidden data-no-translate>
          {initial}
        </span>
        <span className="cvq-account-id">
          <span className="cvq-account-name">{email ?? "Your account"}</span>
          <span className="cvq-account-plan">{label} plan</span>
        </span>
        <svg width="11" height="7" viewBox="0 0 11 7" fill="none" aria-hidden style={{ flexShrink: 0 }}>
          <path d="M1.5 1.5 5.5 5.5 9.5 1.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="cvq-account-menu" role="menu">
          <div className="cvq-menu-head">
            <div className="cvq-menu-label">Signed in as</div>
            <div className="cvq-account-name">{email ?? "Your account"}</div>
          </div>
          {plan === "free" && (
            <Link href="/pricing" role="menuitem" className="cvq-menu-item cvq-menu-item--accent" onClick={() => setOpen(false)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              Upgrade to Pro
            </Link>
          )}
          <form action="/auth/signout" method="post" style={{ margin: 0 }}>
            <button type="submit" role="menuitem" className="cvq-menu-item">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── Shell chrome ────────────────────────────────────────────────────────────
function Sidebar({ active }: { active: NavKey | null }) {
  return (
    <aside className="cvq-sidebar" aria-label="Primary">
      <Link href="/research" className="cvq-wordmark">
        <Wordmark />
      </Link>
      <nav>
        <ul className="cvq-nav">
          {NAV.map((item) => (
            <li key={item.key}>
              <Link href={item.href} className="cvq-nav-link" aria-current={active === item.key ? "page" : undefined}>
                <span className="cvq-nav-ico">{item.icon}</span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <AccountMenu />
    </aside>
  );
}

function MobileChrome({ active }: { active: NavKey | null }) {
  return (
    <>
      <header className="cvq-topbar" aria-label="Top bar">
        <Link href="/research" className="cvq-wordmark">
          <Wordmark />
        </Link>
        <AccountMenu />
      </header>
      <nav className="cvq-tabbar" aria-label="Primary">
        {NAV.map((item) => (
          <Link key={item.key} href={item.href} className="cvq-tab" aria-current={active === item.key ? "page" : undefined}>
            {item.icon}
            {item.label}
          </Link>
        ))}
      </nav>
    </>
  );
}

/**
 * AppFrame — mounted once in the root layout. On the logged-in surfaces it
 * paints the warm-paper canvas and the shell (desktop sidebar / mobile bottom
 * tabs + account menu); on public/marketing/auth pages it renders children
 * untouched. This is the single replacement for the retired DashNav.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname() ?? "/";

  if (!showsShell(pathname)) return <>{children}</>;

  const active = activeKey(pathname);
  return (
    <div className="app-frame app-frame--shell">
      <Sidebar active={active} />
      <MobileChrome active={active} />
      <main className="app-main">{children}</main>
    </div>
  );
}
