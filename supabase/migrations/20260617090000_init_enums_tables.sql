-- Project Tracker — Phase 0 schema (PRD §21)
-- 0001: enumerations + the eight tables, with keys, constraints and indexes.
-- All ids are UUID; every table carries created_at; mutable tables carry updated_at.

begin;

-- --------------------------------------------------------------------------
-- §21.2 Enumerations
-- --------------------------------------------------------------------------
-- Project, milestone and task all share the same status set.
create type entity_status as enum ('draft', 'in_progress', 'on_hold', 'completed', 'at_risk');
create type user_role     as enum ('admin', 'manager', 'member', 'viewer');
create type user_status   as enum ('active', 'inactive');
create type file_type     as enum ('pdf', 'png', 'jpg', 'docx', 'xlsx');

-- --------------------------------------------------------------------------
-- users — linked 1:1 to the managed auth identity (auth.users).
-- Auth provider holds the password hash; this table never stores credentials.
-- --------------------------------------------------------------------------
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

-- --------------------------------------------------------------------------
-- user_visibility — many-to-many visibility grants (PRD §17).
-- viewer can see all projects owned by owner. Independent of role.
-- --------------------------------------------------------------------------
create table user_visibility (
  id              uuid primary key default gen_random_uuid(),
  viewer_user_id  uuid not null references users (id) on delete cascade,
  owner_user_id   uuid not null references users (id) on delete cascade,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now(),
  constraint user_visibility_unique unique (viewer_user_id, owner_user_id),
  constraint user_visibility_no_self check (viewer_user_id <> owner_user_id)
);

create index user_visibility_viewer_idx on user_visibility (viewer_user_id);
create index user_visibility_owner_idx  on user_visibility (owner_user_id);

-- --------------------------------------------------------------------------
-- projects — target_date is NOT stored; it is derived (PRD §12.2 / §21.3).
-- parent_project_id is a one-level self-reference (PRD §14); the one-level
-- depth is enforced by trigger in the next migration.
-- --------------------------------------------------------------------------
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

create index projects_owner_idx  on projects (owner_user_id);
create index projects_parent_idx on projects (parent_project_id);

-- --------------------------------------------------------------------------
-- milestones — target_date required (PRD §12.1).
-- --------------------------------------------------------------------------
create table milestones (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  name        text not null,
  target_date date not null,
  status      entity_status not null default 'draft',
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index milestones_project_idx on milestones (project_id);

-- --------------------------------------------------------------------------
-- tasks — milestone_id NULL means project-level. The CHECK enforces the
-- date rule: a project-level task must have a target_date (PRD §12.1).
-- --------------------------------------------------------------------------
create table tasks (
  id           uuid primary key default gen_random_uuid(),
  project_id   uuid not null references projects (id) on delete cascade,
  milestone_id uuid references milestones (id) on delete cascade,
  name         text not null,
  start_date   date,
  target_date  date,
  status       entity_status not null default 'draft',
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  constraint tasks_project_level_needs_target
    check (milestone_id is not null or target_date is not null)
);

create index tasks_project_idx   on tasks (project_id);
create index tasks_milestone_idx on tasks (milestone_id);

-- --------------------------------------------------------------------------
-- task_updates — append-only history (PRD §13). No update/delete in v1.
-- --------------------------------------------------------------------------
create table task_updates (
  id              uuid primary key default gen_random_uuid(),
  task_id         uuid not null references tasks (id) on delete cascade,
  author_user_id  uuid not null references users (id) on delete restrict,
  body            text not null,
  created_at      timestamptz not null default now()
);

create index task_updates_task_idx on task_updates (task_id, created_at desc);

-- --------------------------------------------------------------------------
-- attachments — object-storage pointer; validated + scanned before persist.
-- --------------------------------------------------------------------------
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

create index attachments_project_idx on attachments (project_id);

-- --------------------------------------------------------------------------
-- audit_log — access/membership/mapping changes (PRD §20.2).
-- --------------------------------------------------------------------------
create table audit_log (
  id             uuid primary key default gen_random_uuid(),
  actor_user_id  uuid references users (id) on delete set null,
  action         text not null,
  entity_type    text not null,
  entity_id      uuid,
  detail         jsonb,
  created_at     timestamptz not null default now()
);

create index audit_log_entity_idx on audit_log (entity_type, entity_id);

commit;
