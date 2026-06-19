-- 0007: Project members (post-v1 extension). A project keeps its single owner
-- ("Responsible"), but may now also have MEMBERS. A member can SEE the project
-- (it appears in their list and they can open it) and EDIT it fully — edit
-- fields, manage milestones/tasks/files, AND post task updates — i.e. a
-- co-owner for editing. Members, the owner and admins may all add/remove members.
--
-- This broadens the access model (PRD §17–18 visibility/edit, and §13 which had
-- restricted task updates to owner/admin) — recorded in docs/decisions.md
-- (2026-06-19). It is additive and backward-compatible: a project with no
-- members behaves exactly as before. The DB/RLS stays the security boundary.

begin;

create table project_members (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  user_id     uuid not null references users (id) on delete cascade,
  created_by  uuid references users (id) on delete set null,
  created_at  timestamptz not null default now(),
  constraint project_members_unique unique (project_id, user_id)
);

create index project_members_project_idx on project_members (project_id);
create index project_members_user_idx on project_members (user_id);

-- --------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so they read project_members / projects
-- without being re-filtered (and so the policies that call them can't recurse).
-- --------------------------------------------------------------------------

-- Is the caller a member of this project?
create or replace function is_project_member(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from project_members m
    where m.project_id = p_project_id
      and m.user_id = auth.uid()
  );
$$;

-- Project-aware visibility companion to can_see_project_owner(owner): visible if
-- the owner is visible to the caller (own / mapped / admin) OR the caller is a member.
create or replace function can_see_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select can_see_project_owner((select owner_user_id from projects where id = p_project_id))
    or is_project_member(p_project_id);
$$;

-- Edit capability now also covers members (PRD §18 + members extension). All the
-- child-row write policies and the task_updates INSERT policy call this, so
-- members inherit full edit + update rights with no further policy changes.
create or replace function can_edit_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_admin()
    or exists (
      select 1 from projects p
      where p.id = p_project_id
        and p.owner_user_id = auth.uid()
    )
    or is_project_member(p_project_id);
$$;

-- --------------------------------------------------------------------------
-- project_members RLS: readable if you can see the project; add/remove by
-- owner/admin/member (= can_edit_project).
-- --------------------------------------------------------------------------
alter table project_members enable row level security;

create policy project_members_select_visible on project_members
  for select to authenticated
  using (can_see_project(project_id));

create policy project_members_write_editor on project_members
  for all to authenticated
  using (can_edit_project(project_id))
  with check (can_edit_project(project_id));

-- --------------------------------------------------------------------------
-- Broaden SELECT (and project UPDATE) to include members. The projects table
-- has its id in-row; child rows resolve the project via can_see_project().
-- --------------------------------------------------------------------------
drop policy projects_select_visible on projects;
create policy projects_select_visible on projects
  for select to authenticated
  using (can_see_project_owner(owner_user_id) or is_project_member(id));

-- Members may edit the project row itself (name/status/start/objective). Owner
-- reassignment stays admin-only in the UI; delete stays owner/admin (unchanged).
drop policy projects_update_owner_or_admin on projects;
create policy projects_update_editor on projects
  for update to authenticated
  using (can_edit_project(id))
  with check (can_edit_project(id));

drop policy milestones_select_visible on milestones;
create policy milestones_select_visible on milestones
  for select to authenticated
  using (can_see_project(project_id));

drop policy tasks_select_visible on tasks;
create policy tasks_select_visible on tasks
  for select to authenticated
  using (can_see_project(project_id));

drop policy attachments_select_visible on attachments;
create policy attachments_select_visible on attachments
  for select to authenticated
  using (can_see_project(project_id));

drop policy task_updates_select_visible on task_updates;
create policy task_updates_select_visible on task_updates
  for select to authenticated
  using (can_see_project((select project_id from tasks where id = task_id)));

commit;
