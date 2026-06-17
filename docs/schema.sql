-- Project Tracker — canonical schema mirror (PRD §21).
--
-- This file is the human-readable reference for the whole schema. It mirrors the
-- migrations in supabase/migrations/ (which are what actually run).
--
-- Verified against the live hosted database on 2026-06-17 by introspection
-- (enums, key constraints, derived view, RLS policies all match). NOTE: this
-- network blocks the Postgres ports, so `pg_dump` / `supabase db dump` cannot be
-- used here; SQL is applied and introspected over HTTPS via the Supabase
-- Management API (see server/scripts/run-sql-api.mjs and the README).
--
-- ==========================================================================
-- Enumerations (§21.2)
-- ==========================================================================
create type entity_status as enum ('draft', 'in_progress', 'on_hold', 'completed', 'at_risk');
create type user_role     as enum ('admin', 'manager', 'member', 'viewer');
create type user_status   as enum ('active', 'inactive');
create type file_type     as enum ('pdf', 'png', 'jpg', 'docx', 'xlsx');

-- ==========================================================================
-- Tables (§21.1)
-- ==========================================================================
create table users (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text        not null,
  email       text        not null unique,
  role        user_role   not null default 'member',
  status      user_status not null default 'active',
  invited_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table user_visibility (
  id              uuid primary key default gen_random_uuid(),
  viewer_user_id  uuid not null references users (id) on delete cascade,
  owner_user_id   uuid not null references users (id) on delete cascade,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint user_visibility_unique unique (viewer_user_id, owner_user_id),
  constraint user_visibility_no_self check (viewer_user_id <> owner_user_id)
);

create table projects (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  owner_user_id     uuid not null references users (id) on delete restrict,
  status            entity_status not null default 'draft',
  start_date        date,
  objective         text,
  parent_project_id uuid references projects (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint projects_not_own_parent check (parent_project_id is null or parent_project_id <> id)
);
-- target_date is NOT stored: derived via view project_target_dates (§12.2/§21.3).

create table milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  name        text not null,
  target_date date not null,                         -- required (§12.1)
  status      entity_status not null default 'draft',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  milestone_id uuid references milestones (id) on delete cascade,  -- NULL = project-level
  name         text not null,
  start_date   date,
  target_date  date,
  status       entity_status not null default 'draft',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_project_level_needs_target
    check (milestone_id is not null or target_date is not null)   -- §12.1
);

create table task_updates (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references tasks (id) on delete cascade,
  author_user_id  uuid not null references users (id) on delete restrict,
  body            text not null,
  created_at      timestamptz not null default now()
);
-- Append-only (§13): no UPDATE/DELETE permitted (enforced via RLS).

create table attachments (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects (id) on delete cascade,
  milestone_id  uuid references milestones (id) on delete cascade,
  task_id       uuid references tasks (id) on delete cascade,
  file_name     text not null,
  file_type     file_type not null,
  size_bytes    bigint not null check (size_bytes > 0),
  storage_path  text not null,
  uploaded_by   uuid not null references users (id) on delete restrict,
  scanned_at    timestamptz,
  created_at    timestamptz not null default now()
);

create table audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references users (id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  detail         jsonb,
  created_at     timestamptz not null default now()
);

-- ==========================================================================
-- Derived project target date (§12.2 / §21.3)
-- ==========================================================================
-- security_invoker=on so the view honours the caller's RLS (PRD §3); added in
-- migration 20260617091000_hardening.sql (Phase 9).
create view project_target_dates with (security_invoker = on) as
select
  p.id as project_id,
  greatest(
    (select max(m.target_date) from milestones m where m.project_id = p.id),
    (select max(t.target_date) from tasks t
       where t.project_id = p.id and t.milestone_id is null)
  ) as target_date
from projects p;

-- ==========================================================================
-- One-level sub-project depth (§14) and updated_at maintenance live in
-- supabase/migrations/20260617090100_triggers.sql.
-- Row-Level Security (the security boundary, §3/§17–18/§21.3) lives in
-- supabase/migrations/20260617090300_rls.sql, with Phase 9 hardening in
-- 20260617091000_hardening.sql (can_create_projects() excludes viewers from the
-- projects INSERT policy; the view above is security_invoker). See those files
-- for the full function and policy definitions; not duplicated here.
-- ==========================================================================
