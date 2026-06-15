-- Migration 025: Academic portal tenancy (edu.conviqt.com).
--
-- The academic subdomain is a SEPARATE product from the retail app, sold to
-- universities. Its access model is institutional, not individual:
--
--   institutions    — a university (or department) that licenses the portal.
--                     `sso_domain` lets a SAML/email-domain match auto-place a
--                     signing-in user into the right institution.
--   cohorts         — a class/section a professor runs for a term. `join_code`
--                     is the pilot-friendly fallback to full SSO: a professor
--                     shares the code, students self-enroll.
--   cohort_members  — who belongs to a cohort and in what role. Role lives on
--                     the membership (a person can be professor in one cohort,
--                     student in another), keyed by email to match the rest of
--                     the codebase (subscribers/user_profiles are email-keyed).
--
-- RLS is ON for defence in depth. Server code uses the service-role client
-- (getSupabaseAdmin), which BYPASSES RLS, so server reads are unaffected; the
-- policies only constrain anon/authenticated direct access, scoping a user to
-- their own memberships and the cohorts they belong to.

-- ── 1. Institutions ─────────────────────────────────────────────────────────
create table if not exists institutions (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  slug        text        not null unique,         -- url-safe handle
  sso_domain  text,                                -- e.g. 'lse.ac.uk' (nullable: code-only pilots)
  created_at  timestamptz not null default now()
);

-- ── 2. Cohorts ──────────────────────────────────────────────────────────────
create table if not exists cohorts (
  id               uuid        primary key default gen_random_uuid(),
  institution_id   uuid        references institutions(id) on delete cascade,
  name             text        not null,           -- 'MSc Finance — Macro, Autumn 2026'
  term             text,                            -- free-text term label
  join_code        text        not null unique,    -- short human code, generated app-side
  professor_email  text        not null,           -- owner; lower-cased app-side
  created_at       timestamptz not null default now()
);

create index if not exists cohorts_institution_idx on cohorts (institution_id);
create index if not exists cohorts_professor_idx   on cohorts (professor_email);

-- ── 3. Cohort membership ────────────────────────────────────────────────────
create table if not exists cohort_members (
  cohort_id  uuid        not null references cohorts(id) on delete cascade,
  email      text        not null,                 -- lower-cased app-side
  role       text        not null default 'student' check (role in ('professor', 'student')),
  joined_at  timestamptz not null default now(),
  primary key (cohort_id, email)
);

create index if not exists cohort_members_email_idx on cohort_members (email);

-- ── 4. RLS — defence in depth (service role bypasses these) ─────────────────
alter table institutions   enable row level security;
alter table cohorts        enable row level security;
alter table cohort_members enable row level security;

-- A signed-in user can see only their own membership rows.
drop policy if exists cohort_members_self_read on cohort_members;
create policy cohort_members_self_read on cohort_members
  for select
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- A user can read the cohorts they belong to (or own as professor).
drop policy if exists cohorts_member_read on cohorts;
create policy cohorts_member_read on cohorts
  for select
  using (
    lower(professor_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or exists (
      select 1 from cohort_members m
      where m.cohort_id = cohorts.id
        and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );

-- A user can read institutions tied to a cohort they belong to.
drop policy if exists institutions_member_read on institutions;
create policy institutions_member_read on institutions
  for select
  using (
    exists (
      select 1
      from cohorts c
      join cohort_members m on m.cohort_id = c.id
      where c.institution_id = institutions.id
        and lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  );
