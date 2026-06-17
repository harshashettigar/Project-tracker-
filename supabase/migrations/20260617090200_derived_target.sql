-- 0003: derived project target date (PRD §12.2 / §21.3).
-- Target date is never stored. It is the latest target_date across a project's
-- milestones and its directly-attached (milestone_id IS NULL) tasks; NULL when none.

begin;

create view project_target_dates as
select
  p.id as project_id,
  greatest(
    (select max(m.target_date) from milestones m where m.project_id = p.id),
    (select max(t.target_date) from tasks t
       where t.project_id = p.id and t.milestone_id is null)
  ) as target_date
from projects p;

comment on view project_target_dates is
  'Derived project target date (PRD §12.2): latest target across milestones and direct tasks; NULL when none.';

commit;
