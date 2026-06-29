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

export function GoogleOAuthButton({
  onClick,
  loading,
  label = "Continue with Google",
}: {
  onClick: () => void;
  loading?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: "var(--radius-control)",
        padding: "11px 20px",
        fontFamily: "var(--font-ui), system-ui, sans-serif",
        fontWeight: 600,
        fontSize: 14,
        background: "var(--bg-surface)",
        color: "var(--text)",
        border: "1px solid var(--border-strong)",
        cursor: loading ? "default" : "pointer",
        opacity: loading ? 0.6 : 1,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {/* Google "G" logo */}
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615Z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18Z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332Z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58Z"
          fill="#EA4335"
        />
      </svg>
      {loading ? "Redirecting…" : label}
    </button>
  );
}

export function AuthDivider() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        margin: "4px 0",
      }}
    >
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
      <span
        style={{
          fontFamily: "var(--font-ui), system-ui, sans-serif",
          fontSize: 12,
          color: "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        or
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
    </div>
  );
}
