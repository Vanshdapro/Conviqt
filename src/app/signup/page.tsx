"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  AuthShell,
  authInputStyle,
  authLabelStyle,
  authButtonStyle,
} from "@/components/AuthShell";

function SignupInner() {
  const params = useSearchParams();
  const next = params.get("next") || "/chat";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setLoading(true);
    setError(null);

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
      setError(error.message);
      setLoading(false);
      return;
    }

    setSent(true);
    setLoading(false);
  }

  async function handleResend() {
    setResendLoading(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.resend({ type: "signup", email: email.trim().toLowerCase() });
    setResendLoading(false);
    setResendSent(true);
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
              style={{ color: "#4f87f7", background: "none", border: "none", cursor: "pointer", padding: 0, font: "inherit" }}
            >
              Go back
            </button>
          </>
        }
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              background: "rgba(79,135,247,0.08)",
              border: "1px solid rgba(79,135,247,0.2)",
              borderRadius: 10,
              padding: "16px",
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: 13,
              color: "rgba(232,237,248,0.7)",
              lineHeight: 1.7,
            }}
          >
            <strong style={{ color: "#e8edf8", fontWeight: 600 }}>Click the link in your email to activate your account</strong>
            {" "}and claim your 50 free monthly credits. You will not be able to sign in before verifying.
          </div>

          <div
            style={{
              background: "rgba(251,191,36,0.06)",
              border: "1px solid rgba(251,191,36,0.18)",
              borderRadius: 10,
              padding: "12px 16px",
              fontFamily: "var(--font-serif), Georgia, serif",
              fontSize: 12,
              color: "rgba(251,191,36,0.8)",
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
              border: "1px solid rgba(232,237,248,0.12)",
              borderRadius: 10,
              padding: "10px 16px",
              fontFamily: "var(--font-sans), system-ui, sans-serif",
              fontSize: 13,
              color: resendSent ? "rgba(52,211,153,0.8)" : "rgba(232,237,248,0.55)",
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
      subtitle="Start with 50 free credits every month. No card required."
      footer={
        <>
          Already have an account?{" "}
          <Link href={`/login?next=${encodeURIComponent(next)}`} style={{ color: "#4f87f7" }}>
            Sign in
          </Link>
        </>
      }
    >
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
          <p style={{ fontSize: 12, color: "#f87171", margin: 0, fontFamily: "var(--font-sans), sans-serif" }}>
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
