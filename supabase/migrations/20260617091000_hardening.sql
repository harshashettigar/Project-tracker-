-- 0004: Phase 9 hardening.
--  (a) Viewers must not be able to create projects, at the DB layer (PRD §18).
--      The original projects INSERT policy only checked ownership/admin, so a
--      viewer was blocked only by the API. Add a role check via a helper.
--  (b) Make the derived-target view honour the caller's RLS (security_invoker),
--      so it can never leak rows across the visibility boundary if queried
--      directly (PRD §12.2/§3).

begin;

-- (a) Who may create projects: active admin/manager/member (not viewer). §18.
create or replace function can_create_projects()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from users
    where id = auth.uid()
      and status = 'active'
      and role in ('admin', 'manager', 'member')
  );
$$;

drop policy if exists projects_insert_owner_or_admin on projects;
create policy projects_insert_owner_or_admin on projects
  for insert to authenticated
  with check (
    is_admin()
    or (owner_user_id = auth.uid() and can_create_projects())
  );

-- (b) The derived-target view now runs with the querying user's privileges, so
-- RLS on the underlying tables applies to it too.
alter view project_target_dates set (security_invoker = on);

commit;
