-- Project Tracker — dog-food sample data (Phase 0).
-- Runs as service_role (RLS bypassed).
--
-- PREREQUISITE: run the auth setup script FIRST:
--   cd server && npm run setup:auth
-- That creates the four auth identities AND their matching public.users rows.
-- This file then adds sample projects, resolving owners by email so the
-- foreign keys line up regardless of the auth-generated user UUIDs.
--
-- Idempotent: on conflict do nothing.

begin;

-- --- Visibility: manager may see the member's projects (PRD §17) ----------
insert into user_visibility (viewer_user_id, owner_user_id, created_by)
select
  (select id from users where email = 'manager.demo@manipalsplchem.com'),
  (select id from users where email = 'member.demo@manipalsplchem.com'),
  (select id from users where email = 'appuser1.msc@manipalsplchem.com')
on conflict (viewer_user_id, owner_user_id) do nothing;

-- --- Projects -------------------------------------------------------------
-- p1: member-owned, with a milestone and tasks. p2: manager-owned.
-- p3: a one-level sub-project of p1.
insert into projects (id, name, owner_user_id, status, start_date, objective, parent_project_id) values
  ('11111111-1111-1111-1111-111111111101', 'Plant Safety Audit 2026',
     (select id from users where email = 'member.demo@manipalsplchem.com'),
     'in_progress', '2026-01-10', 'Complete the annual safety audit across all units.', null),
  ('11111111-1111-1111-1111-111111111102', 'ERP Rollout',
     (select id from users where email = 'manager.demo@manipalsplchem.com'),
     'draft', '2026-03-01', 'Roll out the new ERP to finance and procurement.', null),
  ('11111111-1111-1111-1111-111111111103', 'Audit — Unit B',
     (select id from users where email = 'member.demo@manipalsplchem.com'),
     'in_progress', '2026-02-01', 'Unit B portion of the safety audit.',
     '11111111-1111-1111-1111-111111111101')
on conflict (id) do nothing;

-- --- Milestones (target_date required) ------------------------------------
insert into milestones (id, project_id, name, target_date, status, sort_order) values
  ('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111101', 'Documentation review', '2026-04-30', 'in_progress', 1),
  ('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111101', 'On-site inspection',    '2026-06-30', 'draft',       2)
on conflict (id) do nothing;

-- --- Tasks ----------------------------------------------------------------
-- Milestone-level tasks (target optional) + a project-level task (target required).
insert into tasks (id, project_id, milestone_id, name, start_date, target_date, status, sort_order) values
  ('33333333-3333-3333-3333-333333333301', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 'Collect SOP documents', '2026-01-15', '2026-03-15', 'completed',   1),
  ('33333333-3333-3333-3333-333333333302', '11111111-1111-1111-1111-111111111101', '22222222-2222-2222-2222-222222222201', 'Gap analysis',          '2026-03-16', null,         'in_progress', 2),
  ('33333333-3333-3333-3333-333333333303', '11111111-1111-1111-1111-111111111101', null,                                   'Kickoff sign-off',      '2026-01-10', '2026-01-20', 'completed',   1)
on conflict (id) do nothing;

-- --- Task updates (append-only history) -----------------------------------
insert into task_updates (task_id, author_user_id, body)
select '33333333-3333-3333-3333-333333333301',
       (select id from users where email = 'member.demo@manipalsplchem.com'),
       'All unit SOP documents collected and indexed.'
where not exists (
  select 1 from task_updates
  where task_id = '33333333-3333-3333-3333-333333333301'
    and body = 'All unit SOP documents collected and indexed.'
);

insert into task_updates (task_id, author_user_id, body)
select '33333333-3333-3333-3333-333333333302',
       (select id from users where email = 'member.demo@manipalsplchem.com'),
       'Gap analysis started; reviewing against ISO checklist.'
where not exists (
  select 1 from task_updates
  where task_id = '33333333-3333-3333-3333-333333333302'
    and body = 'Gap analysis started; reviewing against ISO checklist.'
);

commit;
