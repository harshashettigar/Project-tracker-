-- 0008: Task priority (post-v1 extension). Each task gets a priority — Low / Mid
-- / High — defaulting to 'mid' (the "normal" middle priority). Additive and
-- backward-compatible: existing tasks default to 'mid'. No RLS change needed —
-- tasks are already gated by can_edit_project / can_see_project.

begin;

create type task_priority as enum ('low', 'mid', 'high');

alter table tasks
  add column priority task_priority not null default 'mid';

commit;
