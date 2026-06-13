import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// OpenAI provider — Conviqt's single AI chokepoint.
//
// Every agent in the app talks to the model through getOpenAI().messages, which
// presents the SAME request/response surface the codebase has always used
// (system blocks, client tools with input_schema, a web_search server tool,
// content blocks of type text/tool_use/server_tool_use/web_search_tool_result,
// and a usage block with input/output/cache token buckets).
//
// Under the hood this is the OpenAI Responses API — the only OpenAI surface
// that runs built-in web search ALONGSIDE custom function tools, which Sweep,
// Headline Decoder, and the Analyst all require. The adapter below translates
// between the two shapes so the ~28 agent files never had to change.
//
// Provenance: OpenAI returns the URLs a search actually consulted via
// `web_search_call.action.sources` (requested through `include`) plus inline
// `url_citation` annotations. We rebuild those into the `web_search_tool_result`
// blocks the provenance validators (sweep.ts / provenance.ts) expect, so the
// "every fact cites a real, search-returned URL" guarantee is preserved.
// ─────────────────────────────────────────────────────────────────────────────

let client: OpenAI | null = null;

// Reads OPENAI_API_KEY with a dev-mode fallback. In Claude Code's desktop
// environment the parent shell can inject an empty OPENAI_API_KEY that shadows
// .env.local; if we see an empty shell var in development we parse .env.local
// directly. (Kept from the previous provider's loader — same failure mode.)
function resolveApiKey(): string {
  const fromEnv = process.env.OPENAI_API_KEY ?? "";
  if (fromEnv.trim()) return fromEnv.trim();

  if (process.env.NODE_ENV === "development") {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fs = require("fs") as typeof import("fs");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const path = require("path") as typeof import("path");
      const contents = fs.readFileSync(
        path.resolve(process.cwd(), ".env.local"),
        "utf8"
      );
      const match = contents.match(/^OPENAI_API_KEY=(.+)$/m);
      // Strip surrounding quotes — Next's own loader does, so this fallback
      // must too (a quoted key otherwise fails SDK validation).
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // .env.local missing or unreadable — fall through to the error below
    }
  }

  return fromEnv;
}

function rawClient(): OpenAI {
  if (!client) {
    const apiKey = resolveApiKey();
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server."
      );
    }
    client = new OpenAI({ apiKey });
  }
  return client;
}

// ─── Model IDs ───────────────────────────────────────────────────────────────
//
// Kept in one place so a role can be re-pointed without hunting through agents.
//
// Mapping rationale (finance-first): GPT-4.1 is the flagship the financial
// industry has standardized on (Morgan Stanley, JPMorgan, Goldman tooling) and
// is heavily weighted toward financial text. 4.1-mini covers the cheap,
// high-frequency structured/classification work the way Haiku used to.
//
// Pricing (USD per million tokens, OpenAI standard tier, as of 2026-06):
//   gpt-4.1-mini : $0.40 in / $1.60 out  (cached in $0.10)
//   gpt-4.1      : $2.00 in / $8.00 out  (cached in $0.50)
// Both are cheaper than the Sonnet/Haiku tiers they replace.
//
// Web search server tool: ~$25 / 1000 calls at "low" context (see
// WEB_SEARCH_COST_USD). There is no per-call hard cap like the old max_uses —
// the search budget is governed by the prompts ("you have up to 2 searches").
//
// Role selection (mirrors the old tiering — see CLAUDE.md cost targets):
// - mini  : intent routing, sweep, specialists, base judge, scheduled feed,
//           regime/mosaic/council scorecards, per-name sector scorecards.
// - gpt-4.1: the marquee syntheses — comparative & sector judges, stock picker,
//           CIO portfolio constructor, and the general Analyst chat.
const MINI = "gpt-4.1-mini" as const;
const FLAGSHIP = "gpt-4.1" as const;

export const MODELS = {
  router: MINI,
  sweep: MINI,
  specialist: MINI,
  judge: MINI,
  comparativeJudge: FLAGSHIP,
  picker: FLAGSHIP,
  analyst: FLAGSHIP, // general chat — flagship for institutional depth
  // Alpha Tracker institutional pipeline:
  regime: MINI, // macro regime read — search-driven, structured
  mosaic: MINI, // deep "small factors" edge scan — search-driven extraction
  council: MINI, // 6-lens scorecard — one tight structured call
  cio: FLAGSHIP, // CIO + portfolio constructor — the high-stakes synthesis
  // Sector Snapshot pipeline:
  sectorTicker: MINI, // abbreviated per-name scorecard — one tight structured call
  sectorJudge: FLAGSHIP, // thematic synthesis across 5-8 names — the marquee output
  // Scheduled Dashboard/Headlines content (Phase 4)
  feed: MINI,
} as const;

// Per-model unit costs in USD per token.
// OpenAI bills a cache WRITE at the normal input rate (no surcharge) and a
// cache READ at a discount, so cacheWrite == input here and the adapter always
// reports cache_creation_input_tokens = 0 (see mapUsage).
export const PRICING_PER_TOKEN = {
  "gpt-4.1": {
    input: 2 / 1_000_000,
    output: 8 / 1_000_000,
    cacheWrite: 2 / 1_000_000,
    cacheRead: 0.5 / 1_000_000,
  },
  "gpt-4.1-mini": {
    input: 0.4 / 1_000_000,
    output: 1.6 / 1_000_000,
    cacheWrite: 0.4 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
  },
  "gpt-4.1-nano": {
    input: 0.1 / 1_000_000,
    output: 0.4 / 1_000_000,
    cacheWrite: 0.1 / 1_000_000,
    cacheRead: 0.025 / 1_000_000,
  },
} as const;

// Cost per web_search server tool invocation. OpenAI's web search runs ~$25 per
// 1000 calls at "low" search-context size. (The previous provider was ~$0.01.)
export const WEB_SEARCH_COST_USD = 0.025;

// Web search server-tool definitions. These keep the historical Anthropic-style
// shape because agents pass them straight into `tools`; the adapter detects any
// tool whose `type` starts with "web_search" and swaps in OpenAI's built-in
// web_search tool. `max_uses` is advisory only (the prompts enforce the cap;
// OpenAI's tool has no hard per-call limit).
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

// Analyst gets more search latitude — general questions may cross-reference
// several live data sources (macro print + earnings + sector move).
export const ANALYST_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3,
};

// Helper: estimate USD cost of a single call given its usage block and an
// optional explicit web_search count. Signature unchanged from the previous
// provider so every call site keeps working; the cache buckets are filled by
// mapUsage (cache_creation is always 0 on OpenAI).
export function estimateCallCostUSD(
  model: keyof typeof PRICING_PER_TOKEN,
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | null;
    cache_read_input_tokens?: number | null;
  },
  webSearchCount = 0
): number {
  const price = PRICING_PER_TOKEN[model];
  if (!price) return 0;
  return (
    usage.input_tokens * price.input +
    usage.output_tokens * price.output +
    (usage.cache_creation_input_tokens ?? 0) * price.cacheWrite +
    (usage.cache_read_input_tokens ?? 0) * price.cacheRead +
    webSearchCount * WEB_SEARCH_COST_USD
  );
}

// ─── Anthropic-shaped request/response surface ────────────────────────────────
// Permissive param types so the existing ~28 call sites compile unchanged; the
// adapter narrows them at runtime. The RESPONSE types are broad-but-explicit so
// agents can read block.type / .name / .input / .text / .content freely.

export interface AIUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
}

export interface AIContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  content?: unknown;
  tool_use_id?: string;
}

export interface AIMessage {
  id: string;
  model: string;
  role: "assistant";
  stop_reason: string;
  content: AIContentBlock[];
  usage: AIUsage;
}

interface CreateParams {
  model: string;
  max_tokens?: number;
  system?: unknown;
  tools?: readonly unknown[];
  tool_choice?: unknown;
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: unknown }>;
  temperature?: number;
}

// ─── Translation: Anthropic params → OpenAI Responses params ───────────────────

function flattenSystem(system: unknown): string | undefined {
  if (!system) return undefined;
  if (typeof system === "string") return system;
  if (Array.isArray(system)) {
    const text = system
      .map((b) => (typeof b === "string" ? b : asRecord(b)?.text))
      .filter((t): t is string => typeof t === "string" && t.length > 0)
      .join("\n\n");
    return text || undefined;
  }
  return undefined;
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

// Flatten a message's content (string OR array of Anthropic-style blocks) into
// plain text for the Responses `input`. Assistant turns replayed by Headline
// carry their prior search results as text so a forced follow-up can still cite
// real URLs; provenance itself is re-validated from the original blocks, not
// from this serialization.
function flattenContent(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const parts: string[] = [];
  for (const raw of content) {
    if (typeof raw === "string") {
      parts.push(raw);
      continue;
    }
    const b = asRecord(raw);
    if (!b) continue;
    switch (b.type) {
      case "text":
        if (typeof b.text === "string") parts.push(b.text);
        break;
      case "tool_use":
        parts.push(`[called ${String(b.name ?? "tool")}: ${safeJson(b.input)}]`);
        break;
      case "server_tool_use": {
        const q = asRecord(b.input)?.query;
        parts.push(`[web search: ${typeof q === "string" ? q : ""}]`);
        break;
      }
      case "web_search_tool_result": {
        const inner = Array.isArray(b.content) ? b.content : [];
        const urls = inner
          .map((r) => asRecord(r))
          .filter((r): r is Record<string, unknown> => r?.type === "web_search_result")
          .map((r) => {
            const url = String(r.url ?? "");
            const title = typeof r.title === "string" ? ` — ${r.title}` : "";
            return `${url}${title}`;
          })
          .filter((s) => s.length > 0);
        if (urls.length) parts.push(`[search results found:\n${urls.join("\n")}]`);
        break;
      }
      default:
        break;
    }
  }
  return parts.join("\n");
}

type ToolChoiceOut =
  | "auto"
  | "required"
  | "none"
  | { type: "function"; name: string }
  | undefined;

function mapToolChoice(tc: unknown): ToolChoiceOut {
  const r = asRecord(tc);
  if (!r) return undefined;
  if (r.type === "tool" && typeof r.name === "string") {
    return { type: "function", name: r.name };
  }
  if (r.type === "any") return "required";
  if (r.type === "auto") return "auto";
  if (r.type === "none") return "none";
  return undefined;
}

interface BuiltRequest {
  req: OpenAI.Responses.ResponseCreateParams;
}

function buildRequest(params: CreateParams): BuiltRequest {
  const tools: OpenAI.Responses.Tool[] = [];
  let hasWebSearch = false;

  for (const raw of params.tools ?? []) {
    const t = asRecord(raw);
    if (!t) continue;
    const type = typeof t.type === "string" ? t.type : "";
    if (type.startsWith("web_search")) {
      hasWebSearch = true;
      tools.push({ type: "web_search", search_context_size: "low" });
    } else if (typeof t.name === "string") {
      tools.push({
        type: "function",
        name: t.name,
        description: typeof t.description === "string" ? t.description : undefined,
        parameters: asRecord(t.input_schema) ?? { type: "object", properties: {} },
        strict: false,
      });
    }
  }

  const input: OpenAI.Responses.ResponseInputItem[] = params.messages.map((m) => ({
    role: m.role,
    content: flattenContent(m.content),
  }));

  const req: OpenAI.Responses.ResponseCreateParams = {
    model: params.model,
    input,
    max_output_tokens: params.max_tokens,
  };

  const instructions = flattenSystem(params.system);
  if (instructions) req.instructions = instructions;
  if (tools.length) req.tools = tools;
  if (hasWebSearch) req.include = ["web_search_call.action.sources"];
  if (typeof params.temperature === "number") req.temperature = params.temperature;

  const tc = mapToolChoice(params.tool_choice);
  if (tc !== undefined) req.tool_choice = tc;

  return { req };
}

// ─── Translation: OpenAI Responses output → Anthropic-shaped message ───────────

function hostTitle(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function mapUsage(usage: OpenAI.Responses.ResponseUsage | undefined): AIUsage {
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const totalInput = usage?.input_tokens ?? 0;
  return {
    // Match the previous provider's semantics: input_tokens EXCLUDES cached.
    input_tokens: Math.max(0, totalInput - cached),
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
}

function mapResponse(response: OpenAI.Responses.Response): AIMessage {
  const blocks: AIContentBlock[] = [];
  // Canonical URL set the searches actually returned, keyed by raw URL so the
  // provenance validators (which normalize on their side) can match.
  const canonical = new Map<string, { url: string; title: string }>();

  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text") {
          blocks.push({ type: "text", text: part.text });
          for (const ann of part.annotations ?? []) {
            if (ann.type === "url_citation" && typeof ann.url === "string") {
              if (!canonical.has(ann.url)) {
                canonical.set(ann.url, {
                  url: ann.url,
                  title: typeof ann.title === "string" && ann.title ? ann.title : hostTitle(ann.url),
                });
              }
            }
          }
        }
      }
    } else if (item.type === "function_call") {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(item.arguments || "{}");
      } catch {
        parsed = {};
      }
      blocks.push({ type: "tool_use", id: item.call_id, name: item.name, input: parsed });
    } else if (item.type === "web_search_call") {
      const action = item.action as
        | { type?: string; query?: string; queries?: string[]; sources?: Array<{ url?: string }> }
        | undefined;
      const query = action?.queries?.[0] ?? action?.query ?? "";
      blocks.push({ type: "server_tool_use", id: item.id, name: "web_search", input: { query } });
      if (action?.type === "search" && Array.isArray(action.sources)) {
        for (const s of action.sources) {
          if (s && typeof s.url === "string" && !canonical.has(s.url)) {
            canonical.set(s.url, { url: s.url, title: hostTitle(s.url) });
          }
        }
      }
    }
  }

  // Rebuild the web_search_tool_result block the provenance validators read.
  if (canonical.size > 0) {
    blocks.push({
      type: "web_search_tool_result",
      tool_use_id: "ws",
      content: Array.from(canonical.values()).map((c) => ({
        type: "web_search_result",
        url: c.url,
        title: c.title,
      })),
    });
  }

  const stopReason = blocks.some((b) => b.type === "tool_use")
    ? "tool_use"
    : response.status === "incomplete" &&
        response.incomplete_details?.reason === "max_output_tokens"
      ? "max_tokens"
      : "end_turn";

  return {
    id: response.id,
    model: response.model,
    role: "assistant",
    stop_reason: stopReason,
    content: blocks,
    usage: mapUsage(response.usage),
  };
}

// ─── Streaming wrapper (mirrors the old messages.stream contract) ──────────────

type TextHandler = (text: string) => void;

class MessageStream {
  private textHandlers: TextHandler[] = [];
  private final: Promise<AIMessage>;

  constructor(params: CreateParams) {
    // run() begins synchronously and suspends at the first network await, so
    // .on("text", …) registered immediately after construction is in place
    // before any delta can arrive.
    this.final = this.run(params);
  }

  on(event: "text", handler: TextHandler): this {
    if (event === "text") this.textHandlers.push(handler);
    return this;
  }

  private async run(params: CreateParams): Promise<AIMessage> {
    const { req } = buildRequest(params);
    const stream = await rawClient().responses.create({ ...req, stream: true });
    let finalResponse: OpenAI.Responses.Response | null = null;
    for await (const event of stream) {
      if (event.type === "response.output_text.delta") {
        const delta = event.delta;
        if (delta) for (const h of this.textHandlers) h(delta);
      } else if (event.type === "response.completed") {
        finalResponse = event.response;
      }
    }
    if (!finalResponse) {
      throw new Error("[openai] stream completed without a final response");
    }
    return mapResponse(finalResponse);
  }

  finalMessage(): Promise<AIMessage> {
    return this.final;
  }
}

// ─── Public client ─────────────────────────────────────────────────────────────

export interface AIClient {
  messages: {
    create(params: CreateParams): Promise<AIMessage>;
    stream(params: CreateParams): MessageStream;
  };
}

let adapter: AIClient | null = null;

export function getOpenAI(): AIClient {
  if (!adapter) {
    adapter = {
      messages: {
        async create(params: CreateParams): Promise<AIMessage> {
          const { req } = buildRequest(params);
          const response = await rawClient().responses.create({ ...req, stream: false });
          return mapResponse(response);
        },
        stream(params: CreateParams): MessageStream {
          return new MessageStream(params);
        },
      },
    };
  }
  return adapter;
}
