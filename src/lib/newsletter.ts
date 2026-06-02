// Newsletter subscriber persistence (Deliverable 6 — the Disagreement Digest).
//
// Free, email-only list with DOUBLE OPT-IN. Distinct from `subscribers`
// (Stripe customers) — see migration 016 for why.
//
// Lifecycle:
//   subscribe(email)         → row created 'pending' with a confirm_token,
//                              caller emails the confirm link.
//   confirmByToken(token)    → 'pending' → 'confirmed'. Only confirmed rows
//                              get the weekly digest.
//   unsubscribeByToken(tok)  → any → 'unsubscribed' (one-click, no auth).
//   listConfirmed()          → who the cron sends to (+ their unsub token).
//   claimSend(weekKey)       → atomic "I'm sending this week's issue" gate so
//                              a retry / double-fire can't blast the list twice.
//
// Auto-selects backend (same pattern as watchlist.ts / stockReports.ts):
//   - Supabase  when NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY set
//   - JSON file (data/newsletter-*.json) otherwise — local dev without Supabase

import fs from "fs";
import path from "path";
import crypto from "crypto";

export type SubscriberStatus = "pending" | "confirmed" | "unsubscribed";

export interface Subscriber {
  email: string;
  status: SubscriberStatus;
  confirmToken: string;
  unsubscribeToken: string;
  createdAt: string;
}

export interface ConfirmedRecipient {
  email: string;
  unsubscribeToken: string;
}

// What subscribe() returns so the route knows whether to send a confirm email.
export interface SubscribeResult {
  subscriber: Subscriber;
  // 'created'   — brand-new pending row, SEND the confirmation email.
  // 'pending'   — already on the list but not yet confirmed, RESEND confirmation.
  // 'confirmed' — already confirmed, do nothing (idempotent, no email).
  // 'resubscribe' — was unsubscribed, reset to pending, SEND confirmation again.
  outcome: "created" | "pending" | "confirmed" | "resubscribe";
}

function newToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

function normEmail(email: string): string {
  return email.toLowerCase().trim();
}

// RFC-5322-lite. Good enough to reject obvious garbage before we mint a token.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  const e = normEmail(email);
  return e.length <= 254 && EMAIL_RE.test(e);
}

export interface NewsletterStore {
  subscribe(email: string, source?: string): Promise<SubscribeResult>;
  confirmByToken(token: string): Promise<string | null>; // returns email, or null if no match
  unsubscribeByToken(token: string): Promise<string | null>;
  listConfirmed(): Promise<ConfirmedRecipient[]>;
  confirmedCount(): Promise<number>;
  // Atomic weekly gate. true = this caller won the claim and should send.
  claimSend(weekKey: string, recipientCount: number, tickerCount: number): Promise<boolean>;
}

// --------------------------------------------------------------------------
// File store (local dev, no Supabase required)
// --------------------------------------------------------------------------

const SUBS_FILE = path.resolve(process.cwd(), "data/newsletter-subscribers.json");
const SENDS_FILE = path.resolve(process.cwd(), "data/newsletter-sends.json");

interface FileSubRow {
  email: string;
  status: SubscriberStatus;
  confirm_token: string;
  unsubscribe_token: string;
  source?: string;
  created_at: string;
  confirmed_at?: string;
  unsubscribed_at?: string;
}

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return fallback;
  }
}

function writeJson(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2), "utf8");
}

function toSubscriber(r: FileSubRow): Subscriber {
  return {
    email: r.email,
    status: r.status,
    confirmToken: r.confirm_token,
    unsubscribeToken: r.unsubscribe_token,
    createdAt: r.created_at,
  };
}

class FileNewsletterStore implements NewsletterStore {
  private rows(): FileSubRow[] {
    return readJson<FileSubRow[]>(SUBS_FILE, []);
  }

  async subscribe(email: string, source?: string): Promise<SubscribeResult> {
    const e = normEmail(email);
    const rows = this.rows();
    const existing = rows.find((r) => r.email === e);
    const now = new Date().toISOString();

    if (existing) {
      if (existing.status === "confirmed") {
        return { subscriber: toSubscriber(existing), outcome: "confirmed" };
      }
      // pending or unsubscribed → (re)issue a fresh confirm token and re-arm.
      const wasUnsub = existing.status === "unsubscribed";
      existing.status = "pending";
      existing.confirm_token = newToken();
      existing.confirmed_at = undefined;
      existing.unsubscribed_at = undefined;
      if (source) existing.source = source;
      writeJson(SUBS_FILE, rows);
      return {
        subscriber: toSubscriber(existing),
        outcome: wasUnsub ? "resubscribe" : "pending",
      };
    }

    const row: FileSubRow = {
      email: e,
      status: "pending",
      confirm_token: newToken(),
      unsubscribe_token: newToken(),
      source,
      created_at: now,
    };
    rows.push(row);
    writeJson(SUBS_FILE, rows);
    return { subscriber: toSubscriber(row), outcome: "created" };
  }

  async confirmByToken(token: string): Promise<string | null> {
    const rows = this.rows();
    const row = rows.find((r) => r.confirm_token === token);
    if (!row) return null;
    if (row.status !== "confirmed") {
      row.status = "confirmed";
      row.confirmed_at = new Date().toISOString();
      writeJson(SUBS_FILE, rows);
    }
    return row.email;
  }

  async unsubscribeByToken(token: string): Promise<string | null> {
    const rows = this.rows();
    const row = rows.find((r) => r.unsubscribe_token === token);
    if (!row) return null;
    if (row.status !== "unsubscribed") {
      row.status = "unsubscribed";
      row.unsubscribed_at = new Date().toISOString();
      writeJson(SUBS_FILE, rows);
    }
    return row.email;
  }

  async listConfirmed(): Promise<ConfirmedRecipient[]> {
    return this.rows()
      .filter((r) => r.status === "confirmed")
      .map((r) => ({ email: r.email, unsubscribeToken: r.unsubscribe_token }));
  }

  async confirmedCount(): Promise<number> {
    return this.rows().filter((r) => r.status === "confirmed").length;
  }

  async claimSend(
    weekKey: string,
    recipientCount: number,
    tickerCount: number
  ): Promise<boolean> {
    const log = readJson<Record<string, unknown>>(SENDS_FILE, {});
    if (log[weekKey]) return false;
    log[weekKey] = {
      sent_at: new Date().toISOString(),
      recipient_count: recipientCount,
      ticker_count: tickerCount,
    };
    writeJson(SENDS_FILE, log);
    return true;
  }
}

// --------------------------------------------------------------------------
// Supabase store
// --------------------------------------------------------------------------

interface SubRow {
  email: string;
  status: SubscriberStatus;
  confirm_token: string;
  unsubscribe_token: string;
}

function rowToSubscriber(r: SubRow & { created_at?: string }): Subscriber {
  return {
    email: r.email,
    status: r.status,
    confirmToken: r.confirm_token,
    unsubscribeToken: r.unsubscribe_token,
    createdAt: r.created_at ?? new Date().toISOString(),
  };
}

class SupabaseNewsletterStore implements NewsletterStore {
  private async db() {
    const { getSupabaseAdmin } = await import("./supabase");
    return getSupabaseAdmin();
  }

  async subscribe(email: string, source?: string): Promise<SubscribeResult> {
    const db = await this.db();
    const e = normEmail(email);

    const { data: existing, error: selErr } = await db
      .from("newsletter_subscribers")
      .select("email, status, confirm_token, unsubscribe_token, created_at")
      .eq("email", e)
      .maybeSingle();
    if (selErr) throw new Error(`newsletter.subscribe select: ${selErr.message}`);

    if (existing) {
      const row = existing as SubRow & { created_at: string };
      if (row.status === "confirmed") {
        return { subscriber: rowToSubscriber(row), outcome: "confirmed" };
      }
      const wasUnsub = row.status === "unsubscribed";
      const confirmToken = newToken();
      const { data: updated, error: updErr } = await db
        .from("newsletter_subscribers")
        .update({
          status: "pending",
          confirm_token: confirmToken,
          confirmed_at: null,
          unsubscribed_at: null,
          ...(source ? { source } : {}),
        })
        .eq("email", e)
        .select("email, status, confirm_token, unsubscribe_token, created_at")
        .single();
      if (updErr) throw new Error(`newsletter.subscribe update: ${updErr.message}`);
      return {
        subscriber: rowToSubscriber(updated as SubRow & { created_at: string }),
        outcome: wasUnsub ? "resubscribe" : "pending",
      };
    }

    const insert = {
      email: e,
      status: "pending" as const,
      confirm_token: newToken(),
      unsubscribe_token: newToken(),
      source: source ?? null,
    };
    const { data: created, error: insErr } = await db
      .from("newsletter_subscribers")
      .insert(insert)
      .select("email, status, confirm_token, unsubscribe_token, created_at")
      .single();
    // Race: another request inserted the same email between our select and
    // insert. Treat the unique violation as "already pending" and re-fetch.
    if (insErr) {
      if ((insErr as { code?: string }).code === "23505") {
        const { data: race } = await db
          .from("newsletter_subscribers")
          .select("email, status, confirm_token, unsubscribe_token, created_at")
          .eq("email", e)
          .maybeSingle();
        if (race) {
          const row = race as SubRow & { created_at: string };
          return {
            subscriber: rowToSubscriber(row),
            outcome: row.status === "confirmed" ? "confirmed" : "pending",
          };
        }
      }
      throw new Error(`newsletter.subscribe insert: ${insErr.message}`);
    }
    return {
      subscriber: rowToSubscriber(created as SubRow & { created_at: string }),
      outcome: "created",
    };
  }

  async confirmByToken(token: string): Promise<string | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("newsletter_subscribers")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
      .eq("confirm_token", token)
      .neq("status", "unsubscribed") // don't silently revive an unsubscribed row
      .select("email")
      .maybeSingle();
    if (error) throw new Error(`newsletter.confirmByToken: ${error.message}`);
    return data ? (data as { email: string }).email : null;
  }

  async unsubscribeByToken(token: string): Promise<string | null> {
    const db = await this.db();
    const { data, error } = await db
      .from("newsletter_subscribers")
      .update({ status: "unsubscribed", unsubscribed_at: new Date().toISOString() })
      .eq("unsubscribe_token", token)
      .select("email")
      .maybeSingle();
    if (error) throw new Error(`newsletter.unsubscribeByToken: ${error.message}`);
    return data ? (data as { email: string }).email : null;
  }

  async listConfirmed(): Promise<ConfirmedRecipient[]> {
    const db = await this.db();
    const { data, error } = await db
      .from("newsletter_subscribers")
      .select("email, unsubscribe_token")
      .eq("status", "confirmed");
    if (error) throw new Error(`newsletter.listConfirmed: ${error.message}`);
    return (data ?? []).map((r) => {
      const row = r as { email: string; unsubscribe_token: string };
      return { email: row.email, unsubscribeToken: row.unsubscribe_token };
    });
  }

  async confirmedCount(): Promise<number> {
    const db = await this.db();
    const { count, error } = await db
      .from("newsletter_subscribers")
      .select("email", { count: "exact", head: true })
      .eq("status", "confirmed");
    if (error) throw new Error(`newsletter.confirmedCount: ${error.message}`);
    return count ?? 0;
  }

  async claimSend(
    weekKey: string,
    recipientCount: number,
    tickerCount: number
  ): Promise<boolean> {
    const db = await this.db();
    const { error } = await db.from("newsletter_send_log").insert({
      week_key: weekKey,
      recipient_count: recipientCount,
      ticker_count: tickerCount,
    });
    if (!error) return true;
    if ((error as { code?: string }).code === "23505") return false; // already sent this week
    throw new Error(`newsletter.claimSend: ${error.message}`);
  }
}

// --------------------------------------------------------------------------
// Factory — auto-detects backend (mirrors watchlist.isSupabaseConfigured)
// --------------------------------------------------------------------------

export function isSupabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (url && key) return true;
  if (process.env.NODE_ENV === "development") {
    try {
      const raw = fs.readFileSync(path.resolve(process.cwd(), ".env.local"), "utf8");
      const get = (name: string) =>
        raw.match(new RegExp(`^${name}=(.+)$`, "m"))?.[1]?.trim();
      return !!(get("NEXT_PUBLIC_SUPABASE_URL") && get("SUPABASE_SERVICE_ROLE_KEY"));
    } catch {
      return false;
    }
  }
  return false;
}

let _store: NewsletterStore | null = null;

export function getNewsletterStore(): NewsletterStore {
  if (_store) return _store;
  _store = isSupabaseConfigured()
    ? new SupabaseNewsletterStore()
    : new FileNewsletterStore();
  return _store;
}

// --------------------------------------------------------------------------
// ISO week key — the idempotency unit for the weekly send.
// --------------------------------------------------------------------------

// Returns e.g. "2026-W23". ISO-8601 week: weeks start Monday, week 1 is the
// week containing the first Thursday of the year.
export function isoWeekKey(d: Date = new Date()): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Sun=0 → 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // shift to the week's Thursday
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}
