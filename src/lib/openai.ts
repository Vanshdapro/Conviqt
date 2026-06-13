import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ─────────────────────────────────────────────────────────────────────────────
// AI gateway — Conviqt's single AI chokepoint, now DUAL-PROVIDER.
//
// Every agent talks to the model through getOpenAI().messages, which presents
// the SAME request/response surface the codebase has always used (system
// blocks, client tools with input_schema, a web_search server tool, content
// blocks of type text/tool_use/server_tool_use/web_search_tool_result, and a
// usage block with input/output/cache token buckets).
//
// ROUTING (founder decision 2026-06-13 — cost): OpenAI's built-in web search
// costs ~2.5¢/call vs Anthropic's ~1¢, so:
//   • Any call that includes a web_search tool  → ANTHROPIC (Claude).
//   • Every other (pure-reasoning) call          → OPENAI (Responses API).
//
// Why search-using calls run *entirely* on Claude: Anthropic's web_search
// returns results as ENCRYPTED content that only Claude can read — we never see
// the page text. So the search and the reasoning that consumes it are
// inseparable; they must happen on the same provider. The cheap searches (and
// the agents that drive them — sweep/headline/analyst/picker/regime/mosaic/feed)
// therefore run on Claude with their original, proven behavior. The heavy
// pure-reasoning agents (specialists, base judge, comparative/sector judges,
// CIO, router) run on OpenAI / GPT-4.1.
//
// The agents already pass Anthropic-shaped params, so the Claude path forwards
// them almost verbatim (only the model id is translated). The OpenAI path
// translates Anthropic params ⇄ the Responses API shape.
// ─────────────────────────────────────────────────────────────────────────────

// ─── Clients (lazy singletons) ─────────────────────────────────────────────────

let openaiClient: OpenAI | null = null;
let anthropicClient: Anthropic | null = null;

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

function rawAnthropic(): Anthropic {
  if (!anthropicClient) {
    const apiKey = resolveKey("ANTHROPIC_API_KEY");
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. It powers Conviqt's web search. Add it to .env.local and restart the dev server."
      );
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ─── Model IDs ───────────────────────────────────────────────────────────────
//
// Agents reference these OpenAI ids everywhere. On the Claude (web-search) path
// the adapter translates them to the equivalent Claude id via CLAUDE_MODEL — so
// search agents keep the exact Haiku/Sonnet tiering they always had.
//
// Pricing (USD per 1M tokens, as of 2026-06):
//   gpt-4.1-mini : $0.40 in / $1.60 out      claude-haiku-4-5   : $1 / $5
//   gpt-4.1      : $2.00 in / $8.00 out       claude-sonnet-4-6  : $3 / $15
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
  regime: MINI,
  mosaic: MINI,
  council: MINI,
  cio: FLAGSHIP,
  sectorTicker: MINI,
  sectorJudge: FLAGSHIP,
  feed: MINI,
} as const;

// OpenAI model id → Claude model id, used only on the web-search path.
const CLAUDE_MODEL: Record<string, string> = {
  "gpt-4.1": "claude-sonnet-4-6",
  "gpt-4.1-mini": "claude-haiku-4-5-20251001",
  "gpt-4.1-nano": "claude-haiku-4-5-20251001",
};

function claudeModelFor(openaiModel: string): string {
  return CLAUDE_MODEL[openaiModel] ?? "claude-haiku-4-5-20251001";
}

// Per-model unit costs in USD per token. Keyed by the OpenAI ids the agents pass
// to estimateCallCostUSD. NOTE: on the Claude (web-search) path the actual
// per-token cost is Claude's, so these become an approximation for those calls —
// acceptable because (a) metering is log-only and (b) search runs are dominated
// by the per-search fee, not tokens.
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

// Cost per web_search invocation. Searches run on Anthropic (~$10 / 1000).
export const WEB_SEARCH_COST_USD = 0.01;

// Web search server-tool definitions — native Anthropic shape, passed straight
// through to Claude on the web-search path.
export const WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 2,
};

export const ANALYST_WEB_SEARCH_TOOL = {
  type: "web_search_20250305" as const,
  name: "web_search" as const,
  max_uses: 3,
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
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

// Does this call use the web_search server tool? → route to Anthropic.
function usesWebSearch(tools: readonly unknown[] | undefined): boolean {
  if (!tools) return false;
  return tools.some((t) => {
    const type = asRecord(t)?.type;
    return typeof type === "string" && type.startsWith("web_search");
  });
}

// ─── Anthropic (web-search) path ───────────────────────────────────────────────
// Params are already Anthropic-shaped; only the model id is translated.

function anthropicParams(params: CreateParams): Record<string, unknown> {
  return {
    ...params,
    model: claudeModelFor(params.model),
    max_tokens: params.max_tokens ?? 1024,
  };
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

function buildOpenAIRequest(params: CreateParams): OpenAI.Responses.ResponseCreateParams {
  const tools: OpenAI.Responses.Tool[] = [];

  for (const raw of params.tools ?? []) {
    const t = asRecord(raw);
    if (!t) continue;
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

  const tc = mapToolChoice(params.tool_choice);
  if (tc !== undefined) req.tool_choice = tc;

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

function mapResponse(response: OpenAI.Responses.Response): AIMessage {
  const blocks: AIContentBlock[] = [];

  for (const item of response.output ?? []) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text") {
          blocks.push({ type: "text", text: part.text });
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
          if (usesWebSearch(params.tools)) {
            // Web-search path → Anthropic. Params are already Anthropic-shaped.
            const res = await rawAnthropic().messages.create(
              anthropicParams(params) as unknown as Anthropic.MessageCreateParamsNonStreaming
            );
            return res as unknown as AIMessage;
          }
          // Reasoning path → OpenAI Responses.
          const req = buildOpenAIRequest(params);
          const response = await rawOpenAI().responses.create({ ...req, stream: false });
          return mapResponse(response);
        },
        stream(params: CreateParams): AIMessageStream {
          if (usesWebSearch(params.tools)) {
            // Web-search path → Anthropic's native streaming (same .on/.finalMessage).
            return rawAnthropic().messages.stream(
              anthropicParams(params) as unknown as Anthropic.MessageStreamParams
            ) as unknown as AIMessageStream;
          }
          return new OpenAIMessageStream(params);
        },
      },
    };
  }
  return adapter;
}
