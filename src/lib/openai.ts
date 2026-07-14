import OpenAI from "openai";

// ─────────────────────────────────────────────────────────────────────────────
// AI gateway — Conviqt's single AI chokepoint. SINGLE-PROVIDER: OpenAI only,
// gpt-4.1-mini for EVERY function. No Claude/Anthropic, no OpenRouter/DeepSeek.
//
// Every agent talks to the model through getOpenAI().messages, which presents
// the SAME Anthropic-shaped request/response surface the codebase has always
// used (system blocks, client tools with input_schema, a web_search server
// tool, content blocks of type text/tool_use/server_tool_use/
// web_search_tool_result, and a usage block with input/output/cache token
// buckets). The adapter translates that surface ⇄ the OpenAI Responses API so
// the ~28 call sites — and the whole provenance system that parses
// web_search_tool_result blocks — keep working unchanged.
//
// WEB SEARCH: runs on OpenAI's built-in `web_search` tool (Responses API,
// supported on gpt-4.1-mini). We pass include:["web_search_call.action.sources"]
// to get back the COMPLETE list of URLs the model consulted — the direct analog
// of Anthropic's web_search_tool_result URL set — and reconstruct Anthropic-
// shaped `server_tool_use` + `web_search_tool_result` blocks from OpenAI's
// `web_search_call` output items + url_citation annotations. That is what lets
// sweep/picker/regime/mosaic/earnings/analyst/headline validate every cited
// source URL exactly as before (the "every claim traceable" brand promise).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Client (lazy singleton) ───────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;

// Reads an API key from env with a dev-mode .env.local fallback. In Claude
// Code's desktop environment the parent shell can inject an empty key that
// shadows .env.local; if we see an empty shell var in development we parse
// .env.local directly.
function resolveKey(varName: string): string {
  const fromEnv = process.env[varName] ?? "";
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
      const match = contents.match(new RegExp(`^${varName}=(.+)$`, "m"));
      if (match) return match[1].trim().replace(/^["']|["']$/g, "");
    } catch {
      // .env.local missing or unreadable — fall through to the error below
    }
  }

  return fromEnv;
}

function rawOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = resolveKey("OPENAI_API_KEY");
    if (!apiKey) {
      throw new Error(
        "OPENAI_API_KEY is not set. Add it to .env.local and restart the dev server."
      );
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

// ─── Model IDs ───────────────────────────────────────────────────────────────
//
// EVERY function runs on gpt-4.1-mini. One model, one provider.
//
// Pricing (USD per 1M tokens, as of 2026-06):
//   gpt-4.1-mini : $0.40 in / $1.60 out
const MINI = "gpt-4.1-mini" as const;

export const MODELS = {
  router: MINI,
  sweep: MINI,
  specialist: MINI,
  judge: MINI,
  comparativeJudge: MINI,
  picker: MINI,
  analyst: MINI,
  regime: MINI,
  mosaic: MINI,
  council: MINI,
  cio: MINI,
  sectorTicker: MINI,
  sectorJudge: MINI,
  feed: MINI,
  // The daily brief / Lens. Formerly DeepSeek via OpenRouter; now gpt-4.1-mini
  // like everything else. `lensPro` (the heavier weekly synthesis) is the same
  // model — kept as a distinct key so call sites don't have to change.
  lens: MINI,
  lensPro: MINI,
} as const;

// Per-model unit costs in USD per token. Keyed by the OpenAI ids the agents pass
// to estimateCallCostUSD.
export const PRICING_PER_TOKEN = {
  "gpt-4.1-mini": {
    input: 0.4 / 1_000_000,
    output: 1.6 / 1_000_000,
    cacheWrite: 0.4 / 1_000_000,
    cacheRead: 0.1 / 1_000_000,
  },
} as const;

// Cost per web_search invocation. Searches run on OpenAI's built-in web_search.
// Log-only estimate — actual billing rides on OpenAI's per-call search fee.
export const WEB_SEARCH_COST_USD = 0.01;

// Web search server-tool definitions — Anthropic shape, kept as the interface
// the agents pass in `tools`. buildOpenAIRequest() detects any tool whose
// `type` starts with "web_search" and swaps it for OpenAI's built-in web search.
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

export const ANALYST_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

// Helper: estimate USD cost of a single call. Signature unchanged from before so
// every call site keeps working.
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

// ─── Shared request/response surface ───────────────────────────────────────────
// Permissive params so the ~28 call sites compile unchanged; broad-but-explicit
// response types so agents read block.type/.name/.input/.text/.content freely.

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

export interface AIMessageStream {
  on(event: "text", handler: (text: string) => void): unknown;
  finalMessage(): Promise<AIMessage>;
}

interface CreateParams {
  model: string;
  max_tokens?: number;
  system?: unknown;
  tools?: readonly unknown[];
  tool_choice?: unknown;
  messages: ReadonlyArray<{ role: "user" | "assistant"; content: unknown }>;
  temperature?: number;
  // Legacy reasoning-exposure flag from the old OpenRouter path. Ignored now —
  // kept so call sites that still pass it (lens thesis) type-check.
  reasoning?: boolean | { effort?: "low" | "medium" | "high" };
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

// ─── OpenAI (Responses) path: param translation ────────────────────────────────

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

function safeJson(v: unknown): string {
  try {
    return JSON.stringify(v);
  } catch {
    return "";
  }
}

// Flatten an Anthropic-shaped message `content` into the plain text the OpenAI
// Responses `input` expects. This also handles multi-turn calls that pass a
// prior assistant turn back (e.g. headline decode), including the web-search
// blocks the adapter synthesized on that earlier turn.
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

// Does this call carry an (Anthropic-shaped) web_search tool? Detected by type,
// so both the shared WEB_SEARCH_TOOL and the agents' inline defs match.
function toolIsWebSearch(t: Record<string, unknown>): boolean {
  return typeof t.type === "string" && t.type.startsWith("web_search");
}

function buildOpenAIRequest(params: CreateParams): OpenAI.Responses.ResponseCreateParams {
  const tools: OpenAI.Responses.Tool[] = [];
  let hasWebSearch = false;

  for (const raw of params.tools ?? []) {
    const t = asRecord(raw);
    if (!t) continue;
    if (toolIsWebSearch(t)) {
      // Anthropic web_search server tool → OpenAI built-in web search.
      hasWebSearch = true;
      continue;
    }
    if (typeof t.name === "string") {
      tools.push({
        type: "function",
        name: t.name,
        description: typeof t.description === "string" ? t.description : undefined,
        parameters: asRecord(t.input_schema) ?? { type: "object", properties: {} },
        strict: false,
      });
    }
  }

  if (hasWebSearch) {
    // OpenAI's built-in web search. Coexists with the client function tools in
    // the same request (the model searches, then calls the report tool).
    tools.push({ type: "web_search" } as unknown as OpenAI.Responses.Tool);
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
  if (typeof params.temperature === "number") req.temperature = params.temperature;

  if (hasWebSearch) {
    // Ask OpenAI to return the COMPLETE list of consulted URLs, not just the
    // inline-cited ones — that's the canonical set provenance validates against.
    (req as { include?: string[] }).include = ["web_search_call.action.sources"];
  }

  const tc = mapToolChoice(params.tool_choice);
  // Never force a specific function while web search must run — forcing a
  // function tool_choice would suppress the search. (No current call site does
  // this, but keep the invariant so search always executes.)
  if (tc !== undefined && !(hasWebSearch && typeof tc === "object")) {
    req.tool_choice = tc;
  }

  return req;
}

// ─── OpenAI path: response translation ─────────────────────────────────────────

function mapUsage(usage: OpenAI.Responses.ResponseUsage | undefined): AIUsage {
  const cached = usage?.input_tokens_details?.cached_tokens ?? 0;
  const totalInput = usage?.input_tokens ?? 0;
  return {
    input_tokens: Math.max(0, totalInput - cached),
    output_tokens: usage?.output_tokens ?? 0,
    cache_read_input_tokens: cached,
    cache_creation_input_tokens: 0,
  };
}

// Map an OpenAI Responses result back to the Anthropic-shaped AIMessage every
// agent reads. Function calls → tool_use blocks; web searches →
// server_tool_use + web_search_tool_result blocks reconstructed from the
// `web_search_call.action.sources` list (plus url_citation annotations), so the
// provenance code sees the same shape it always has.
function mapResponse(response: OpenAI.Responses.Response): AIMessage {
  const blocks: AIContentBlock[] = [];
  const citationUrls = new Map<string, string>(); // url → title, from annotations
  const sourcedUrls = new Set<string>(); // urls already emitted via action.sources
  let hadSearch = false;

  for (const rawItem of (response.output ?? []) as unknown[]) {
    const item = asRecord(rawItem);
    if (!item) continue;

    if (item.type === "message") {
      for (const rawPart of (Array.isArray(item.content) ? item.content : []) as unknown[]) {
        const part = asRecord(rawPart);
        if (!part) continue;
        if (part.type === "output_text") {
          if (typeof part.text === "string") blocks.push({ type: "text", text: part.text });
          for (const rawAnn of (Array.isArray(part.annotations) ? part.annotations : []) as unknown[]) {
            const ann = asRecord(rawAnn);
            if (ann?.type === "url_citation" && typeof ann.url === "string") {
              if (!citationUrls.has(ann.url)) {
                citationUrls.set(ann.url, typeof ann.title === "string" ? ann.title : ann.url);
              }
            }
          }
        }
      }
    } else if (item.type === "function_call") {
      let parsed: unknown = {};
      try {
        parsed = JSON.parse((item.arguments as string) || "{}");
      } catch {
        parsed = {};
      }
      blocks.push({
        type: "tool_use",
        id: typeof item.call_id === "string" ? item.call_id : undefined,
        name: typeof item.name === "string" ? item.name : undefined,
        input: parsed,
      });
    } else if (item.type === "web_search_call") {
      hadSearch = true;
      const action = asRecord(item.action);
      const query = typeof action?.query === "string" ? action.query : "";
      const id = typeof item.id === "string" ? item.id : undefined;
      blocks.push({ type: "server_tool_use", id, name: "web_search", input: { query } });

      const rawSources = Array.isArray(action?.sources) ? (action!.sources as unknown[]) : [];
      const results = rawSources
        .map((s) => {
          const r = asRecord(s);
          const url = typeof r?.url === "string" ? r.url : "";
          if (!url) return null;
          return {
            type: "web_search_result",
            url,
            title: typeof r?.title === "string" ? r.title : url,
          };
        })
        .filter((r): r is { type: string; url: string; title: string } => r !== null);

      if (results.length) {
        for (const r of results) sourcedUrls.add(r.url);
        blocks.push({ type: "web_search_tool_result", tool_use_id: id, content: results });
      }
    }
  }

  // Fold in any inline-cited URLs the sources list didn't already cover, so the
  // provenance allow-list is as complete as OpenAI exposes.
  if (hadSearch) {
    const extra = [...citationUrls.entries()]
      .filter(([url]) => !sourcedUrls.has(url))
      .map(([url, title]) => ({ type: "web_search_result", url, title }));
    if (extra.length) {
      blocks.push({ type: "web_search_tool_result", content: extra });
    }
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

// ─── OpenAI streaming wrapper (mirrors the messages.stream contract) ────────────

type TextHandler = (text: string) => void;

class OpenAIMessageStream implements AIMessageStream {
  private textHandlers: TextHandler[] = [];
  private final: Promise<AIMessage>;

  constructor(params: CreateParams) {
    this.final = this.run(params);
  }

  on(event: "text", handler: TextHandler): this {
    if (event === "text") this.textHandlers.push(handler);
    return this;
  }

  private async run(params: CreateParams): Promise<AIMessage> {
    const req = buildOpenAIRequest(params);
    const stream = await rawOpenAI().responses.create({ ...req, stream: true });
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
      throw new Error("[ai] OpenAI stream completed without a final response");
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
    stream(params: CreateParams): AIMessageStream;
  };
}

let adapter: AIClient | null = null;

export function getOpenAI(): AIClient {
  if (!adapter) {
    adapter = {
      messages: {
        async create(params: CreateParams): Promise<AIMessage> {
          const req = buildOpenAIRequest(params);
          const response = await rawOpenAI().responses.create({ ...req, stream: false });
          return mapResponse(response);
        },
        stream(params: CreateParams): AIMessageStream {
          return new OpenAIMessageStream(params);
        },
      },
    };
  }
  return adapter;
}
