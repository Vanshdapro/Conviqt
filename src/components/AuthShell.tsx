import Link from "next/link";

// Shared shell for the /login and /signup screens — Almanac brand (Phase 7):
// warm paper, espresso ink, one teal accent. All colors come from tokens.css.
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-page)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 20px",
      }}
    >
      {/* Wordmark + tagline */}
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <Link
          href="/"
          className="cvq-wordmark"
         
          style={{ display: "block", marginBottom: 8, fontSize: 18 }}
        >
          CONVI<span className="cvq-wordmark-tick">Q</span>T
        </Link>
        <p
          style={{
            fontFamily: "var(--font-ui), system-ui, sans-serif",
            fontSize: 12,
            letterSpacing: "0.06em",
            color: "var(--text-muted)",
            margin: 0,
          }}
        >
          Your personal team of AI analysts
        </p>
      </div>

      <div
        style={{
          width: "100%",
          maxWidth: 400,
          background: "var(--bg-surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          padding: "32px 28px",
          boxShadow: "0 2px 8px rgba(42,28,21,.06)",
        }}
      >
        <h1
          style={{
            fontFamily: "var(--font-display), Georgia, serif",
            fontWeight: 600,
            fontSize: 26,
            letterSpacing: "-0.01em",
            color: "var(--text)",
            margin: "0 0 6px",
          }}
        >
          {title}
        </h1>
        <p
          style={{
            fontFamily: "var(--font-ui), system-ui, sans-serif",
            fontSize: 14,
            color: "var(--text-muted)",
            margin: "0 0 24px",
            lineHeight: 1.6,
          }}
        >
          {subtitle}
        </p>

        {children}
      </div>

      <div
        style={{
          marginTop: 20,
          fontFamily: "var(--font-ui), system-ui, sans-serif",
          fontSize: 13,
          color: "var(--text-muted)",
        }}
      >
        {footer}
      </div>

      {/* Trust strip */}
      <div
        style={{
          marginTop: 32,
          display: "flex",
          alignItems: "center",
          gap: 20,
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        {[
          "Every pick public — losses included",
          "Plain-English answers",
          "Not financial advice",
        ].map((label) => (
          <span
            key={label}
            style={{
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              fontSize: 11,
              letterSpacing: "0.03em",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span
              style={{
                width: 4,
                height: 4,
                borderRadius: "50%",
                background: "var(--border-strong)",
                flexShrink: 0,
              }}
            />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

export const authInputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--bg-sunken)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-control)",
  padding: "11px 14px",
  fontFamily: "var(--font-ui), system-ui, sans-serif",
  fontSize: 14,
  color: "var(--text)",
  outline: "none",
};

export const authLabelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-ui), system-ui, sans-serif",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.02em",
  color: "var(--text-2)",
  marginBottom: 7,
};

export const authButtonStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: "var(--radius-control)",
  padding: "12px 20px",
  fontFamily: "var(--font-ui), system-ui, sans-serif",
  fontWeight: 600,
  fontSize: 14,
  background: "var(--accent)",
  color: "var(--on-accent)",
  border: "none",
  cursor: "pointer",
  transition: "background 0.2s",
};
