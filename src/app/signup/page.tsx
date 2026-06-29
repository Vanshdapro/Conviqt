"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { track } from "@/lib/analytics/track";
import {
  AuthShell,
  authInputStyle,
  authLabelStyle,
  authButtonStyle,
  GoogleOAuthButton,
  AuthDivider,
} from "@/components/AuthShell";

// Supabase returns terse, sometimes technical auth errors. Map the common ones
// to plain-language guidance so account creation never dead-ends on a raw string.
function friendlySignupError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("user already")) {
    return "An account with this email already exists. Try signing in instead.";
  }
  if (m.includes("password")) {
    return "Password must be at least 8 characters.";
  }
  if (m.includes("valid email") || m.includes("invalid") && m.includes("email")) {
    return "Please enter a valid email address.";
  }
  if (m.includes("rate") || m.includes("too many") || m.includes("after")) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (m.includes("network") || m.includes("fetch")) {
    return "Network error — check your connection and try again.";
  }
  return "Couldn't create your account. Please try again.";
}

function SignupInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/research";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    const supabase = createSupabaseBrowserClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo } });
    // Browser navigates away — no need to reset loading state
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

      const { error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: { full_name: name.trim() },
          emailRedirectTo,
        },
      });

      if (error) {
        setError(friendlySignupError(error.message));
        setLoading(false);
        return;
      }

      track("signup", { method: "password" });
      setSent(true);
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setResendLoading(true);
    try {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
      setResendSent(true);
    } catch {
      // Non-fatal: the original email may still arrive. Leave the button resettable.
    } finally {
      setResendLoading(false);
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your inbox"
        subtitle={`We sent a verification link to ${email}.`}
        footer={
          <>
            Wrong email?{" "}
            <button
              onClick={() => { setSent(false); setResendSent(false); }}
              style={{ color: "var(--link)", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              Go back
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "var(--accent-weak)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              padding: "16px",
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              fontSize: 13,
              color: "var(--text-2)",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "var(--text)", fontWeight: 600 }}>Click the link in your email to activate your account.</strong>
            {" "}You won&apos;t be able to sign in before verifying.
          </div>

          <div
            style={{
              background: "var(--bg-sunken)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              padding: "12px 16px",
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              fontSize: 12,
              color: "var(--text-2)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ fontWeight: 600 }}>Don&apos;t see it?</strong>{" "}
            Check your <strong style={{ fontWeight: 600 }}>spam or junk folder</strong> — confirmation emails sometimes land there, especially for new addresses.
          </div>

          <button
            onClick={handleResend}
            disabled={resendLoading || resendSent}
            style={{
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-control)",
              padding: "10px 16px",
              fontFamily: "var(--font-ui), system-ui, sans-serif",
              fontSize: 13,
              color: resendSent ? "var(--up-ink)" : "var(--text-muted)",
              cursor: resendLoading || resendSent ? "default" : "pointer",
              opacity: resendLoading ? 0.6 : 1,
              transition: "all 0.2s",
            }}
          >
            {resendSent ? "✓ Resent — check your inbox again" : resendLoading ? "Resending…" : "Resend confirmation email"}
          </button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Free to start — 5 deep analyses every month. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} style={{ color: "var(--link)" }}>
            Sign in
          </Link>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <GoogleOAuthButton onClick={handleGoogleSignIn} loading={googleLoading} />
        <AuthDivider />
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <label style={authLabelStyle}>Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Investor"
            style={authInputStyle}
            autoComplete="name"
          />
        </div>
        <div>
          <label style={authLabelStyle}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@email.com"
            style={authInputStyle}
            autoComplete="email"
          />
        </div>
        <div>
          <label style={authLabelStyle}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={authInputStyle}
            autoComplete="new-password"
          />
        </div>

        {error && (
          <p style={{ fontSize: 12, color: "var(--down-ink)", margin: 0, fontFamily: "var(--font-ui), sans-serif" }}>
            {error}
          </p>
        )}

        <button type="submit" disabled={loading} style={{ ...authButtonStyle, opacity: loading ? 0.6 : 1 }}>
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>
    </AuthShell>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupInner />
    </Suspense>
  );
}
