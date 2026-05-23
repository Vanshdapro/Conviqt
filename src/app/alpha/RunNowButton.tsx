"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RunNowButton() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "ok" | "error">("idle");
  const router = useRouter();

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    setStatus("idle");
    try {
      const res = await fetch("/api/alpha/trigger", { method: "POST" });
      if (res.ok) {
        setStatus("ok");
        setTimeout(() => router.refresh(), 800);
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="mono text-[10px] px-2.5 py-1 border border-rule text-dim hover:text-foreground transition-colors disabled:opacity-40"
      style={
        status === "ok"
          ? { color: "var(--bull)", borderColor: "var(--bull)" }
          : status === "error"
          ? { color: "var(--bear)", borderColor: "var(--bear)" }
          : {}
      }
    >
      {loading ? "Running…" : status === "ok" ? "Done ✓" : status === "error" ? "Failed" : "Run Now"}
    </button>
  );
}
