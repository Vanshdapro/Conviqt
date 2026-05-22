"use client";

import { useEffect, useRef, useState } from "react";
import type {
  AgentOutput,
  CouncilResult,
  FocusedResult,
  FactSheet,
  Source,
} from "@/lib/agents/types";
import type { PickerResult } from "@/lib/agents/picker";
import type { CouncilEvent, FocusedEvent } from "@/lib/agents/orchestrator";
import CouncilReport from "./CouncilReport";
import PicksReport from "./PicksReport";

// ── Stream event types ────────────────────────────────────────────────────

type ChatStreamEvent =
  | {
      type: "intent";
      action: "analyze" | "focused" | "pick" | "general" | "reject";
      ticker?: string;
      focus?: string;
      question?: string;
      costUSD: number;
    }
  | { type: "council"; event: CouncilEvent }
  | { type: "focused"; event: FocusedEvent }
  | {
      type: "council_done";
      result: CouncilResult;
      costUSD: number;
      intentCostUSD: number;
    }
  | {
      type: "focused_done";
      result: FocusedResult;
      costUSD: number;
      intentCostUSD: number;
    }
  | {
      type: "picks";
      result: PickerResult;
      costUSD: number;
      intentCostUSD: number;
    }
  | { type: "text_chunk"; delta: string }
  | { type: "text"; text: string; costUSD: number; intentCostUSD: number }
  | { type: "error"; error: string }
  | { type: "done" };

// ── Bubble types ──────────────────────────────────────────────────────────

interface CouncilProgress {
  ticker: string;
  focus?: string;
  runId?: string;
  factSheet?: FactSheet;
  stage: "starting" | "sweeping" | "specialists" | "judging";
}

interface FocusedProgress {
  ticker: string;
  question: string;
  stage: "starting" | "sweeping" | "answering";
}

type Bubble =
  | { id: string; kind: "user"; text: string }
  | { id: string; kind: "text"; text: string; costUSD: number }
  | { id: string; kind: "text_streaming"; text: string }
  | { id: string; kind: "council"; result: CouncilResult; costUSD: number }
  | { id: string; kind: "focused"; result: FocusedResult; costUSD: number }
  | { id: string; kind: "picks"; result: PickerResult; costUSD: number }
  | { id: string; kind: "error"; error: string }
  | { id: string; kind: "loading"; label: string }
  | { id: string; kind: "council_running"; progress: CouncilProgress }
  | { id: string; kind: "focused_running"; progress: FocusedProgress };

// ── Example queries ───────────────────────────────────────────────────────

const EXAMPLES = [
  { label: "analyze NVDA", hint: "Full Council" },
  { label: "analyze AAPL", hint: "Full Council" },
  { label: "Is the yen carry trade fully unwound?", hint: "Macro" },
  { label: "Walk me through yield curve re-steepening", hint: "Rates" },
  { label: "What's driving gold right now?", hint: "Commodities" },
  { label: "What's the macro regime right now?", hint: "Positioning" },
];

function newId() {
  return `b_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

// ── Main component ────────────────────────────────────────────────────────

export default function Chat() {
  const [input, setInput] = useState("");
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [bubbles]);

  function buildApiMessages(
    history: Bubble[]
  ): Array<{ role: "user" | "assistant"; content: string }> {
    type Msg = { role: "user" | "assistant"; content: string };
    return history.flatMap((b): Msg[] => {
      if (b.kind === "user") return [{ role: "user", content: b.text }];
      if (b.kind === "text") return [{ role: "assistant", content: b.text }];
      if (b.kind === "council")
        return [
          {
            role: "assistant",
            content: `Council verdict on ${b.result.ticker}: ${b.result.judge.verdict} (conviction ${b.result.judge.conviction}). ${b.result.judge.investmentCase}`,
          },
        ];
      if (b.kind === "focused")
        return [
          {
            role: "assistant",
            content: `${b.result.ticker}: ${b.result.keyTakeaway} ${b.result.answer}`,
          },
        ];
      if (b.kind === "picks")
        return [
          {
            role: "assistant",
            content:
              b.result.picks.length === 0
                ? `Picker found no qualifying setups. ${b.result.rationale ?? ""}`
                : `Picker returned ${b.result.picks.map((p) => p.ticker).join(", ")}. Regime: ${b.result.regime}`,
          },
        ];
      return [];
    });
  }

  function replaceBubble(id: string, next: Bubble) {
    setBubbles((prev) => prev.map((b) => (b.id === id ? next : b)));
  }

  function dropBubble(id: string) {
    setBubbles((prev) => prev.filter((b) => b.id !== id));
  }

  async function send(prompt: string) {
    const text = prompt.trim();
    if (!text || busy) return;
    setInput("");
    setBusy(true);

    const userBubble: Bubble = { id: newId(), kind: "user", text };
    const loadingBubble: Bubble = {
      id: newId(),
      kind: "loading",
      label: detectLoadingLabel(text),
    };
    const history = [...bubbles, userBubble];
    setBubbles([...history, loadingBubble]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: buildApiMessages(history) }),
      });

      const contentType = res.headers.get("content-type") ?? "";

      if (!contentType.includes("ndjson")) {
        const data = (await res.json()) as ChatStreamEvent;
        applyEvent(data, loadingBubble.id);
        return;
      }

      if (!res.body) {
        replaceBubble(loadingBubble.id, {
          id: newId(),
          kind: "error",
          error: "Stream had no body.",
        });
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) >= 0) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line) continue;
          let event: ChatStreamEvent;
          try {
            event = JSON.parse(line) as ChatStreamEvent;
          } catch (err) {
            console.error("[chat] bad stream line:", line, err);
            continue;
          }
          applyEvent(event, loadingBubble.id);
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setBubbles((prev) => [
        ...prev.filter((b) => b.id !== loadingBubble.id),
        { id: newId(), kind: "error", error: msg },
      ]);
    } finally {
      setBusy(false);
    }
  }

  function applyEvent(event: ChatStreamEvent, loadingId: string) {
    if (event.type === "done") return;

    if (event.type === "error") {
      setBubbles((prev) => [
        ...prev.filter(
          (b) =>
            b.id !== loadingId &&
            b.kind !== "council_running" &&
            b.kind !== "focused_running"
        ),
        { id: newId(), kind: "error", error: event.error },
      ]);
      return;
    }

    if (event.type === "text") {
      setBubbles((prev) => [
        ...prev.filter((b) => b.id !== loadingId && b.kind !== "text_streaming"),
        {
          id: newId(),
          kind: "text",
          text: event.text,
          costUSD: event.costUSD,
        },
      ]);
      return;
    }

    if (event.type === "picks") {
      setBubbles((prev) => [
        ...prev.filter((b) => b.id !== loadingId),
        {
          id: newId(),
          kind: "picks",
          result: event.result,
          costUSD: event.costUSD,
        },
      ]);
      return;
    }

    if (event.type === "text_chunk") {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.id !== loadingId) return b;
          if (b.kind === "text_streaming") {
            return { ...b, text: b.text + event.delta };
          }
          // First chunk — upgrade loading → text_streaming
          return { id: loadingId, kind: "text_streaming", text: event.delta };
        })
      );
      return;
    }

    if (event.type === "intent") {
      if (event.action === "analyze" && event.ticker) {
        replaceBubble(loadingId, {
          id: loadingId,
          kind: "council_running",
          progress: {
            ticker: event.ticker,
            focus: event.focus,
            stage: "starting",
          },
        });
      } else if (event.action === "focused" && event.ticker) {
        replaceBubble(loadingId, {
          id: loadingId,
          kind: "focused_running",
          progress: {
            ticker: event.ticker,
            question: event.question ?? "",
            stage: "starting",
          },
        });
      } else if (event.action === "general") {
        replaceBubble(loadingId, {
          id: loadingId,
          kind: "loading",
          label: "Analyzing…",
        });
      }
      return;
    }

    if (event.type === "council") {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.kind !== "council_running") return b;
          const next = updateCouncilProgress(b.progress, event.event);
          return { ...b, progress: next };
        })
      );
      return;
    }

    if (event.type === "focused") {
      setBubbles((prev) =>
        prev.map((b) => {
          if (b.kind !== "focused_running") return b;
          const next = updateFocusedProgress(b.progress, event.event);
          return { ...b, progress: next };
        })
      );
      return;
    }

    if (event.type === "council_done") {
      setBubbles((prev) => [
        ...prev.filter(
          (b) => b.kind !== "council_running" && b.id !== loadingId
        ),
        {
          id: newId(),
          kind: "council",
          result: event.result,
          costUSD: event.costUSD,
        },
      ]);
      return;
    }

    if (event.type === "focused_done") {
      setBubbles((prev) => [
        ...prev.filter(
          (b) => b.kind !== "focused_running" && b.id !== loadingId
        ),
        {
          id: newId(),
          kind: "focused",
          result: event.result,
          costUSD: event.costUSD,
        },
      ]);
      return;
    }

    dropBubble(loadingId);
  }

  function detectLoadingLabel(prompt: string): string {
    const p = prompt.toLowerCase();
    if (/^analyze\s+/i.test(p)) return "Routing…";
    if (/pick|setup|idea|look at/.test(p)) return "Scanning for setups…";
    if (/(?<![a-z])[A-Z]{2,5}(?![a-z])/.test(prompt)) return "Routing…";
    if (/macro|regime|cycle|rates|yield|fed|fomc|inflation|dollar|yen|carry|spread|credit/.test(p))
      return "Reading the tape…";
    if (/crypto|bitcoin|btc|eth|ethereum/.test(p)) return "Reading the tape…";
    if (/oil|gold|commodity|copper|energy/.test(p)) return "Reading the tape…";
    if (/china|japan|europe|india|emerging|EM|global/.test(p)) return "Reading global markets…";
    return "Analyzing…";
  }

  return (
    <section className="flex-1 flex flex-col min-h-0">
      {/* Empty state */}
      {bubbles.length === 0 && (
        <div className="flex-1 flex items-center justify-center px-5 py-16">
          <div className="w-full max-w-[660px]">
            {/* Status badge */}
            <div className="flex items-center gap-2 mb-7">
              <span className="h-1.5 w-1.5 rounded-full bg-bull pulse" />
              <span className="mono text-[10px] uppercase tracking-[0.18em] text-muted">
                AI Equity Research · Live
              </span>
            </div>

            {/* Headline — DM Serif Display */}
            <h1 className="display text-[2.8rem] lg:text-[3.4rem] text-foreground leading-[1.06] mb-5">
              Research any stock.
              <br />
              <em className="display text-muted" style={{ fontStyle: "italic", fontWeight: 400 }}>
                Every answer cited.
              </em>
            </h1>

            {/* Description */}
            <p className="serif text-[15px] text-muted leading-[1.68] mb-9 max-w-[500px]">
              Ask about any stock, market, or macro force. Five specialist agents
              run in parallel, cite every claim, and disagree openly when the
              evidence splits.
            </p>

            {/* Example queries — 2 col grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXAMPLES.map((ex) => (
                <button
                  key={ex.label}
                  onClick={() => send(ex.label)}
                  disabled={busy}
                  className="group flex items-center justify-between gap-3 border border-rule rounded-lg px-4 py-3 text-left transition-all hover:border-accent/40 disabled:opacity-40"
                  style={{ background: "var(--surface)" }}
                >
                  <span className="serif text-[13.5px] text-foreground/80 group-hover:text-foreground transition-colors leading-snug">
                    {ex.label}
                  </span>
                  <span
                    className="mono text-[9px] text-dim group-hover:text-muted transition-colors flex-shrink-0 tracking-[0.1em] uppercase"
                  >
                    {ex.hint}
                  </span>
                </button>
              ))}
            </div>

            {/* Agent pipeline */}
            <div className="flex flex-wrap gap-1.5 mt-10 pt-8 border-t border-rule">
              {[
                { label: "Sweep", num: "①" },
                { label: "Fundamentals", num: "②" },
                { label: "Technicals", num: "③" },
                { label: "Sentiment", num: "④" },
                { label: "Macro", num: "⑤" },
                { label: "Judge", num: "⑥" },
              ].map(({ label, num }) => (
                <span
                  key={label}
                  className="mono text-[9.5px] text-dim border border-rule rounded-full px-2.5 py-1 tracking-[0.04em]"
                >
                  {num} {label}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Conversation thread */}
      {bubbles.length > 0 && (
        <div ref={scrollRef} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[860px] w-full px-5 lg:px-10 py-8 space-y-5">
            {bubbles.map((b) => (
              <BubbleView
                key={b.id}
                bubble={b}
                onAnalyze={(t) => send(`analyze ${t}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="border-t border-rule flex-shrink-0" style={{ background: "var(--background)" }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="mx-auto max-w-[860px] w-full px-5 lg:px-10 py-3 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="analyze AAPL · explain the yield curve · what's driving gold…"
            disabled={busy}
            className="flex-1 rounded-lg border border-rule px-4 py-3 text-[14px] text-foreground placeholder:text-dim bg-surface focus:outline-none transition-all disabled:opacity-50"
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-border)";
              e.currentTarget.style.boxShadow = "0 0 0 3px rgba(79,116,255,0.06)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--rule)";
              e.currentTarget.style.boxShadow = "none";
            }}
            autoFocus
            suppressHydrationWarning
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="flex items-center justify-center w-10 h-10 rounded-lg border border-rule transition-all disabled:opacity-30 flex-shrink-0"
            style={{ background: input.trim() && !busy ? "var(--accent)" : "var(--surface)" }}
            aria-label="Send"
          >
            {busy ? (
              <span
                className="h-1.5 w-1.5 rounded-full pulse"
                style={{ background: "var(--muted)" }}
              />
            ) : (
              <svg
                width="13"
                height="13"
                viewBox="0 0 14 14"
                fill="none"
                style={{ color: input.trim() ? "white" : "var(--muted)" }}
              >
                <path
                  d="M2 7H12M8 3L12 7L8 11"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>
        </form>
      </div>
    </section>
  );
}

// ── Progress helpers ──────────────────────────────────────────────────────

function updateCouncilProgress(
  prev: CouncilProgress,
  ev: CouncilEvent
): CouncilProgress {
  if (ev.kind === "start")
    return { ...prev, runId: ev.runId, stage: "sweeping" };
  if (ev.kind === "sweep_done")
    return { ...prev, factSheet: ev.factSheet, stage: "specialists" };
  if (ev.kind === "specialist_done") return { ...prev, stage: "specialists" };
  if (ev.kind === "judge_done") return { ...prev, stage: "judging" };
  return prev;
}

function updateFocusedProgress(
  prev: FocusedProgress,
  ev: FocusedEvent
): FocusedProgress {
  if (ev.kind === "start") return { ...prev, stage: "sweeping" };
  if (ev.kind === "sweep_done") return { ...prev, stage: "answering" };
  return prev;
}

// ── Markdown renderer ─────────────────────────────────────────────────────

function parseInline(text: string): React.ReactNode[] {
  // Order matters: [[Publisher]](url) must come before [label](url)
  const parts = text.split(
    /(\*\*[^*\n]+\*\*|`[^`\n]+`|\[\[[^\]]+\]\]\([^)]+\)|\[[^\]]+\]\([^)]+\))/
  );
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="mono text-[11px] rounded px-1.5 py-[2px] text-foreground/90"
          style={{
            background: "rgba(79,116,255,0.09)",
            border: "1px solid rgba(79,116,255,0.18)",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    // [[Publisher]](url) — analyst inline citation format
    if (part.startsWith("[[")) {
      const match = part.match(/^\[\[([^\]]+)\]\]\(([^)]+)\)$/);
      if (match) {
        return (
          <a
            key={i}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="mono text-[10px] text-dim hover:text-muted border border-rule rounded px-1 py-px transition-colors"
            style={{ background: "var(--surface-2)", textDecoration: "none" }}
          >
            {match[1]}
          </a>
        );
      }
    }
    // [label](url) — standard markdown link
    if (part.startsWith("[") && part.includes("](")) {
      const match = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (match) {
        return (
          <a
            key={i}
            href={match[2]}
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:text-foreground underline decoration-accent/30 underline-offset-2 transition-colors"
          >
            {match[1]}
          </a>
        );
      }
    }
    return part;
  });
}

function MarkdownText({ content }: { content: string }) {
  const lines = content.split("\n");
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let isFirstNode = true;

  while (i < lines.length) {
    const line = lines[i];

    // h1
    if (line.startsWith("# ") && !line.startsWith("## ")) {
      nodes.push(
        <h1
          key={i}
          className={`display text-[20px] text-foreground leading-tight ${isFirstNode ? "mt-0" : "mt-6"} mb-2`}
        >
          {parseInline(line.slice(2))}
        </h1>
      );
      i++; isFirstNode = false;
      continue;
    }

    // h2 — institutional section divider
    if (line.startsWith("## ")) {
      nodes.push(
        <div key={i} className={`${isFirstNode ? "mt-0" : "mt-7"} mb-3`}>
          <div className="flex items-center gap-3">
            <span
              className="mono text-[9px] tracking-[0.2em] uppercase"
              style={{ color: "var(--muted)" }}
            >
              {line.slice(3)}
            </span>
            <span
              className="flex-1 h-px"
              style={{ background: "var(--accent-border)" }}
            />
          </div>
        </div>
      );
      i++; isFirstNode = false;
      continue;
    }

    // h3
    if (line.startsWith("### ")) {
      nodes.push(
        <p
          key={i}
          className={`mono text-[10px] tracking-[0.14em] uppercase ${isFirstNode ? "mt-0" : "mt-5"} mb-1.5`}
          style={{ color: "var(--muted)" }}
        >
          {line.slice(4)}
        </p>
      );
      i++; isFirstNode = false;
      continue;
    }

    // horizontal rule
    if (/^---+$/.test(line.trim()) || /^\*\*\*+$/.test(line.trim())) {
      nodes.push(
        <hr key={i} className="border-0 border-t my-5" style={{ borderColor: "var(--rule)" }} />
      );
      i++;
      continue;
    }

    // unordered list
    if (/^[-*] /.test(line)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && /^[-*] /.test(lines[i])) {
        items.push(
          <li key={i} className="flex gap-3 leading-[1.7]">
            <span
              className="flex-shrink-0 mt-[9px] h-[5px] w-[5px] rounded-full"
              style={{ background: "var(--dim)" }}
            />
            <span className="serif text-[15px] text-foreground/88">
              {parseInline(lines[i].slice(2))}
            </span>
          </li>
        );
        i++;
      }
      nodes.push(
        <ul key={`ul-${i}`} className="space-y-2 my-3">
          {items}
        </ul>
      );
      isFirstNode = false;
      continue;
    }

    // ordered list
    if (/^\d+\. /.test(line)) {
      const items: React.ReactNode[] = [];
      let num = 1;
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(
          <li key={i} className="flex gap-3 leading-[1.7]">
            <span className="mono text-[10px] text-dim flex-shrink-0 mt-[5px] w-4 text-right">
              {num}.
            </span>
            <span className="serif text-[15px] text-foreground/88">
              {parseInline(lines[i].replace(/^\d+\. /, ""))}
            </span>
          </li>
        );
        i++;
        num++;
      }
      nodes.push(
        <ol key={`ol-${i}`} className="space-y-2 my-3">
          {items}
        </ol>
      );
      isFirstNode = false;
      continue;
    }

    // empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // paragraph — collect consecutive non-structural lines
    const pLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#/.test(lines[i]) &&
      !/^[-*] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^---+$/.test(lines[i].trim()) &&
      !/^\*\*\*+$/.test(lines[i].trim())
    ) {
      pLines.push(lines[i]);
      i++;
    }
    if (pLines.length > 0) {
      const joined = pLines.join(" ");
      // Opening bold line ("lede") — entire paragraph is **bold**
      const isLede = isFirstNode && /^\*\*[^*]+\*\*[.!?]?$/.test(joined.trim());
      nodes.push(
        <p
          key={`p-${i}`}
          className={
            isLede
              ? "serif text-[16px] font-semibold text-foreground leading-[1.65]"
              : "serif text-[15px] text-foreground/88 leading-[1.72] prose-text"
          }
        >
          {parseInline(joined)}
        </p>
      );
      isFirstNode = false;
    }
  }

  return <div className="space-y-[10px]">{nodes}</div>;
}

// ── Copy button ───────────────────────────────────────────────────────────

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="mono text-[9px] text-dim hover:text-muted transition-colors px-1.5 py-0.5 rounded"
      style={{ background: copied ? "rgba(79,116,255,0.08)" : "transparent" }}
      title="Copy response"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}

// ── Bubble renderers ──────────────────────────────────────────────────────

function BubbleView({
  bubble,
  onAnalyze,
}: {
  bubble: Bubble;
  onAnalyze: (ticker: string) => void;
}) {
  if (bubble.kind === "user") {
    return (
      <div className="flex justify-end">
        <div
          className="max-w-[72%] rounded-2xl rounded-tr-sm px-4 py-2.5 text-[14px] text-foreground/90 leading-relaxed"
          style={{
            background: "var(--surface-3)",
            border: "1px solid rgba(79,116,255,0.12)",
          }}
        >
          {bubble.text}
        </div>
      </div>
    );
  }

  if (bubble.kind === "loading") {
    return (
      <div className="flex items-center gap-2.5 py-1 pl-1">
        <span className="h-1.5 w-1.5 rounded-full pulse" style={{ background: "var(--accent)" }} />
        <span className="mono text-[11px]" style={{ color: "var(--muted)" }}>{bubble.label}</span>
      </div>
    );
  }

  if (bubble.kind === "council_running") {
    return <CouncilRunningCard progress={bubble.progress} />;
  }

  if (bubble.kind === "focused_running") {
    return <FocusedRunningCard progress={bubble.progress} />;
  }

  if (bubble.kind === "error") {
    return (
      <div
        className="rounded px-5 py-4"
        style={{
          borderLeft: "2px solid rgba(244, 63, 94, 0.5)",
          background: "rgba(244, 63, 94, 0.04)",
          paddingLeft: "18px",
        }}
      >
        <div
          className="mono text-[9px] tracking-[0.16em] uppercase mb-2"
          style={{ color: "var(--bear)" }}
        >
          Error
        </div>
        <p className="serif text-[14px] text-foreground/85 leading-relaxed">
          {bubble.error}
        </p>
      </div>
    );
  }

  if (bubble.kind === "text_streaming") {
    return (
      <div
        className="rounded-lg px-6 py-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderLeft: "2px solid var(--accent-border)",
        }}
      >
        <MarkdownText content={bubble.text} />
        <span
          className="inline-block h-[15px] w-[2px] ml-0.5 align-middle pulse"
          style={{ background: "var(--accent)", opacity: 0.7 }}
        />
      </div>
    );
  }

  if (bubble.kind === "text") {
    return (
      <div
        className="rounded-lg px-6 py-6"
        style={{
          background: "var(--surface)",
          border: "1px solid var(--rule)",
          borderLeft: "2px solid var(--accent-border)",
        }}
      >
        <MarkdownText content={bubble.text} />
        <div
          className="flex items-center justify-between mt-5 pt-3"
          style={{ borderTop: "1px solid var(--rule)" }}
        >
          <span className="mono text-[9px] text-dim">
            {bubble.costUSD < 0.001
              ? `<0.1¢`
              : `${(bubble.costUSD * 100).toFixed(2)}¢`}
          </span>
          <CopyButton text={bubble.text} />
        </div>
      </div>
    );
  }

  if (bubble.kind === "council") {
    return <CouncilReport result={bubble.result} costUSD={bubble.costUSD} />;
  }

  if (bubble.kind === "focused") {
    return <FocusedReport result={bubble.result} costUSD={bubble.costUSD} />;
  }

  if (bubble.kind === "picks") {
    return <PicksReport result={bubble.result} onAnalyze={onAnalyze} />;
  }

  return null;
}

// ── Council running card ──────────────────────────────────────────────────

const STAGE_STEPS = ["starting", "sweeping", "specialists", "judging"] as const;
const STAGE_LABELS: Record<string, string> = {
  starting: "Routing to Council…",
  sweeping: "Sweeping the web for cited facts…",
  specialists: "Running specialist agents…",
  judging: "Synthesizing the verdict…",
};

function CouncilRunningCard({ progress }: { progress: CouncilProgress }) {
  const stageIdx = STAGE_STEPS.indexOf(
    progress.stage as (typeof STAGE_STEPS)[number]
  );

  return (
    <article
      className="border border-rule rounded overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="px-5 py-4 border-b border-rule flex items-center justify-between gap-4"
        style={{ background: "var(--surface-2)" }}
      >
        <div className="flex items-baseline gap-2.5">
          <span className="text-[22px] font-semibold text-foreground tracking-tight">
            {progress.ticker}
          </span>
          {progress.focus && (
            <span className="text-[12px] text-muted">· {progress.focus}</span>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-hold pulse" />
          <span className="mono text-[11px] text-muted">
            {STAGE_LABELS[progress.stage]}
          </span>
        </div>
      </div>

      {/* Stage progress */}
      <div className="px-5 py-3.5 flex items-center gap-2">
        {STAGE_STEPS.map((s, idx) => (
          <div key={s} className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  idx < stageIdx
                    ? "bg-bull"
                    : idx === stageIdx
                    ? "bg-hold pulse"
                    : "bg-dim"
                }`}
              />
              <span
                className={`mono text-[10px] capitalize ${
                  idx <= stageIdx ? "text-muted" : "text-dim"
                }`}
              >
                {s}
              </span>
            </div>
            {idx < STAGE_STEPS.length - 1 && (
              <div
                className={`h-px w-5 flex-shrink-0 ${
                  idx < stageIdx ? "bg-bull/30" : "bg-rule"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {progress.factSheet && (
        <div className="px-5 pb-3.5 mono text-[10px] text-dim">
          {progress.factSheet.companyName} · {progress.factSheet.facts.length}{" "}
          facts · {progress.factSheet.sources.length} sources
        </div>
      )}
    </article>
  );
}

// ── Focused running card ──────────────────────────────────────────────────

function FocusedRunningCard({ progress }: { progress: FocusedProgress }) {
  const labels: Record<string, string> = {
    starting: "Routing…",
    sweeping: "Sweeping for live data…",
    answering: "Synthesizing answer…",
  };

  return (
    <article
      className="border border-rule rounded px-5 py-4"
      style={{ background: "var(--surface)" }}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-baseline gap-2.5">
          <span className="text-[22px] font-semibold text-foreground tracking-tight">
            {progress.ticker}
          </span>
          <span className="text-[13px] text-muted">{progress.question}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="h-1.5 w-1.5 rounded-full bg-hold pulse" />
          <span className="mono text-[11px] text-muted">
            {labels[progress.stage]}
          </span>
        </div>
      </div>
    </article>
  );
}

// ── Focused result card ───────────────────────────────────────────────────

function FocusedReport({
  result,
  costUSD,
}: {
  result: FocusedResult;
  costUSD?: number;
}) {
  const citedSources = result.sources
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => result.sourceIndexes.includes(i));

  return (
    <article
      className="border border-rule rounded overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      <header className="border-b border-rule px-5 py-4" style={{ background: "var(--surface-2)" }}>
        <div className="flex items-baseline gap-2.5 flex-wrap">
          <span className="text-[26px] font-semibold text-foreground tracking-tight">
            {result.ticker}
          </span>
          <span className="text-[13px] text-muted">
            {result.companyName}
            {result.sector ? ` · ${result.sector}` : ""}
          </span>
        </div>
        <p className="mono text-[11px] text-dim mt-1">{result.question}</p>
      </header>

      <div className="px-5 pt-5 pb-4 border-b border-rule">
        <div className="caps text-dim mb-2">Key takeaway</div>
        <p className="serif italic text-[20px] text-foreground/95 leading-snug">
          &ldquo;{result.keyTakeaway}&rdquo;
        </p>
      </div>

      <div className="px-5 py-5 border-b border-rule">
        <MarkdownText content={result.answer} />
      </div>

      {citedSources.length > 0 && (
        <section className="px-5 py-4 border-b border-rule">
          <div className="caps text-dim mb-3">Sources</div>
          <ol className="space-y-1.5">
            {citedSources.map(({ s, i }) => (
              <li key={i} className="flex gap-2 text-[12px] text-muted leading-relaxed">
                <span className="mono text-dim flex-shrink-0">#{i}</span>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors underline underline-offset-2 decoration-rule"
                >
                  {s.title}
                </a>
                <span className="text-dim flex-shrink-0">· {s.publisher}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      <footer className="px-5 py-3 mono text-[10px] text-dim flex flex-wrap gap-4">
        <span>asOf {new Date(result.asOf).toLocaleString()}</span>
        <span>run {(result.totalDurationMs / 1000).toFixed(1)}s</span>
        <span>cost ${(costUSD ?? result.estCostUSD).toFixed(4)}</span>
        {result.cached && <span style={{ color: "var(--hold)" }}>cached</span>}
      </footer>
    </article>
  );
}
