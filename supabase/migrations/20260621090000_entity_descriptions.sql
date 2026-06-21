-- 0009: Optional descriptions on milestones + tasks (post-v1 extension). Each
-- milestone and task gains a free-text `description` that is NULL by default and
-- shown in the UI only when present (an "i" popover next to the name). Additive
-- and backward-compatible: existing rows get NULL. No RLS change needed — both
-- tables are already gated by can_edit_project / can_see_project. A length CHECK
-- (DB is the security boundary) caps the field at 2000 chars.

begin;

alter table milestones
  add column description text
    constraint milestones_description_len check (char_length(description) <= 2000);

alter table tasks
  add column description text
    constraint tasks_description_len check (char_length(description) <= 2000);

commit;
