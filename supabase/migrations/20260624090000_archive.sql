-- 0010: Archive (post-v1). Projects, milestones and tasks gain a nullable
-- `archived_at` timestamp — NULL = active, a timestamp = archived. Archive is a
-- separate, reversible, non-destructive lifecycle flag, ORTHOGONAL to `status`
-- (an item can be archived whether completed, cancelled or anything else); it is
-- NOT a new status enum value. Additive and backward-compatible: existing rows are
-- NULL (active). No RLS change needed — archived_at is set/cleared through the
-- existing per-entity UPDATE policies (can_edit_project), and archived rows stay
-- selectable by anyone who can already see them (the API decides default
-- visibility). Archiving does NOT cascade in the data: each row keeps its own
-- flag, so restoring a parent brings children back exactly as they were; the UI
-- simply hides a whole subtree under an archived ancestor.

begin;

alter table projects   add column archived_at timestamptz;
alter table milestones add column archived_at timestamptz;
alter table tasks      add column archived_at timestamptz;

commit;
