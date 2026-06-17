-- 0004: Row-Level Security — the security boundary (PRD §3, §17–18, §21.3).
-- The data layer, not the API or UI, decides what a user may see or change.
--
-- Visibility (PRD §17): a user sees projects they own, projects owned by anyone
-- mapped to them via user_visibility, and — if admin — every project.
-- Capability (PRD §18 / CLAUDE.md access model): create/edit/attach is owner-or-admin;
-- posting a task update is owner-or-admin; managing users & mappings is admin-only.
--
-- The service_role key bypasses RLS, so seeds and admin-API calls are unaffected.

begin;

-- --------------------------------------------------------------------------
-- Helper functions. SECURITY DEFINER so the checks can read users /
-- user_visibility / projects without being re-filtered by the policies that
-- call them (which would otherwise recurse). search_path is pinned for safety.
-- --------------------------------------------------------------------------
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and role = 'admin'
      and status = 'active'
  );
$$;

create or replace function can_see_project_owner(owner uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    owner = auth.uid()
    or is_admin()
    or exists (
      select 1 from user_visibility v
      where v.viewer_user_id = auth.uid()
        and v.owner_user_id = owner
    );
$$;

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
    );
$$;

-- --------------------------------------------------------------------------
-- Enable RLS on every table. With RLS on and no matching policy, access is
-- denied — so each table below gets explicit policies.
-- --------------------------------------------------------------------------
alter table users           enable row level security;
alter table user_visibility enable row level security;
alter table projects        enable row level security;
alter table milestones      enable row level security;
alter table tasks           enable row level security;
alter table task_updates    enable row level security;
alter table attachments     enable row level security;
alter table audit_log       enable row level security;

-- --------------------------------------------------------------------------
-- users — internal staff directory: any authenticated user may read it (needed
-- for owner names/filters across the app). Only admins may write.
-- --------------------------------------------------------------------------
create policy users_select_authenticated on users
  for select to authenticated
  using (true);

create policy users_admin_write on users
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- --------------------------------------------------------------------------
-- user_visibility — managing mappings is admin-only (PRD §18).
-- --------------------------------------------------------------------------
create policy user_visibility_admin_all on user_visibility
  for all to authenticated
  using (is_admin())
  with check (is_admin());

-- --------------------------------------------------------------------------
-- projects — visibility model on read; owner-or-admin on write.
-- --------------------------------------------------------------------------
create policy projects_select_visible on projects
  for select to authenticated
  using (can_see_project_owner(owner_user_id));

create policy projects_insert_owner_or_admin on projects
  for insert to authenticated
  with check (owner_user_id = auth.uid() or is_admin());

create policy projects_update_owner_or_admin on projects
  for update to authenticated
  using (owner_user_id = auth.uid() or is_admin())
  with check (owner_user_id = auth.uid() or is_admin());

create policy projects_delete_owner_or_admin on projects
  for delete to authenticated
  using (owner_user_id = auth.uid() or is_admin());

-- --------------------------------------------------------------------------
-- Child rows (milestones, tasks, attachments): readable if the parent project
-- is visible; writable if the parent project is owned-by-self or by an admin.
-- --------------------------------------------------------------------------
create policy milestones_select_visible on milestones
  for select to authenticated
  using (can_see_project_owner((select owner_user_id from projects where id = project_id)));

create policy milestones_write_editor on milestones
  for all to authenticated
  using (can_edit_project(project_id))
  with check (can_edit_project(project_id));

create policy tasks_select_visible on tasks
  for select to authenticated
  using (can_see_project_owner((select owner_user_id from projects where id = project_id)));

create policy tasks_write_editor on tasks
  for all to authenticated
  using (can_edit_project(project_id))
  with check (can_edit_project(project_id));

create policy attachments_select_visible on attachments
  for select to authenticated
  using (can_see_project_owner((select owner_user_id from projects where id = project_id)));

create policy attachments_write_editor on attachments
  for all to authenticated
  using (can_edit_project(project_id))
  with check (can_edit_project(project_id));

-- --------------------------------------------------------------------------
-- task_updates — append-only (PRD §13). Read if the task's project is visible.
-- INSERT only, restricted to owner-or-admin and to authoring as oneself.
-- No UPDATE/DELETE policy exists, so the history can never be rewritten.
-- --------------------------------------------------------------------------
create policy task_updates_select_visible on task_updates
  for select to authenticated
  using (
    can_see_project_owner(
      (select owner_user_id from projects p
         join tasks t on t.project_id = p.id
        where t.id = task_id)
    )
  );

create policy task_updates_insert_owner_or_admin on task_updates
  for insert to authenticated
  with check (
    author_user_id = auth.uid()
    and can_edit_project((select project_id from tasks where id = task_id))
  );

-- --------------------------------------------------------------------------
-- audit_log — admins may read; writes happen via service role / definer paths.
-- --------------------------------------------------------------------------
create policy audit_log_admin_select on audit_log
  for select to authenticated
  using (is_admin());

commit;
