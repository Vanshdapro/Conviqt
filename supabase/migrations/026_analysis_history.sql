-- Migration 026: Analysis history — a per-user log of every Research run.
--
-- One row per completed analysis the user ran on the Research surface (any
-- skill: Worth Owning?, Quick Take, Face-Off, Sector Pulse, Headline Decoder,
-- Starter Portfolio, Portfolio Health Check, plus free-text asks). The full
-- rendered result is stored as `payload` jsonb so the user can REOPEN any past
-- analysis from their history at zero cost — re-viewing a stored row is a pure
-- DB read (free); only a brand-new run spends a Free deep slot + API budget.
--
-- This is the durable, browsable, per-user complement to the in-memory 4h
-- response cache (src/lib/cache.ts): the cache makes a repeat run cheap for
-- everyone for a few hours; this table lets one user pull back their own past
-- answers indefinitely without ever re-running them.
--
-- All writes go through the service-role admin client (server-side); the route
-- guarantees the email comes from the verified session, never the client.

create table if not exists analysis_history (
  id          uuid         not null default gen_random_uuid() primary key,
  email       text         not null,
  -- Pipeline kind: council | focused | compare | sector | headline |
  -- allocator | audit | text. Mirrors the Research surface's Outcome.kind.
  kind        text         not null,
  -- Research-surface skill id (e.g. 'worth-owning'); null for free-text asks.
  skill_id    text,
  -- The plain-English line the user saw, e.g. "Worth Owning? — NVDA".
  title       text         not null,
  -- Denormalized tickers for list display / search; [] when not ticker-based.
  tickers     text[]       not null default '{}',
  -- The complete rendered outcome (+ a quotes snapshot) needed to re-render
  -- the answer offline with no pipeline run.
  payload     jsonb        not null,
  created_at  timestamptz  not null default now()
);

create index if not exists analysis_history_email_idx
  on analysis_history (email, created_at desc);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Access is only through the service-role admin client (server-side), which
-- bypasses RLS. We still enable RLS with no anon policy so a leaked anon key
-- can never read another user's analysis history.

alter table analysis_history enable row level security;

create policy "service_role_all_analysis_history" on analysis_history
  for all using (auth.role() = 'service_role');
