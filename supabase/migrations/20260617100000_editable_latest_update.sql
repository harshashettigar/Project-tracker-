-- 0005: Allow in-place edit of the LATEST task update only.
--   PRD §13 makes updates append-only. Amended by decision 2026-06-17: the most
--   recent update is correctable (to fix a wrongly-typed entry), but everything
--   before it stays immutable, so the history can still never be rewritten.
--   Capability is owner/admin (same as posting, §11.4); RLS additionally pins the
--   edit to the newest row for the task. The task and author are not reassigned —
--   the API only ever writes `body`.
--
--   The "is this the newest update?" test must NOT query task_updates directly
--   inside the policy — that re-enters RLS on the same table and Postgres raises
--   "infinite recursion detected in policy". It runs in a SECURITY DEFINER helper
--   (RLS-exempt) instead. Idempotent so it can be re-applied safely.

begin;

create or replace function is_latest_task_update(p_update_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
      from task_updates newer
      join task_updates target on target.id = p_update_id
     where newer.task_id = target.task_id
       and newer.created_at > target.created_at
  );
$$;

drop policy if exists task_updates_update_latest on task_updates;

create policy task_updates_update_latest on task_updates
  for update to authenticated
  using (
    can_edit_project((select project_id from tasks where id = task_updates.task_id))
    and is_latest_task_update(task_updates.id)
  )
  with check (
    can_edit_project((select project_id from tasks where id = task_updates.task_id))
  );

commit;
