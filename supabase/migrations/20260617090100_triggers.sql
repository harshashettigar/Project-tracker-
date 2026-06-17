-- 0002: triggers — updated_at maintenance and one-level sub-project depth.

begin;

-- Keep updated_at fresh on every UPDATE of a mutable table.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_set_updated_at      before update on users      for each row execute function set_updated_at();
create trigger projects_set_updated_at   before update on projects   for each row execute function set_updated_at();
create trigger milestones_set_updated_at before update on milestones for each row execute function set_updated_at();
create trigger tasks_set_updated_at      before update on tasks      for each row execute function set_updated_at();

-- Sub-projects are one level only (PRD §14): a project may have a parent,
-- but that parent must itself be a top-level project. This blocks grandchildren.
create or replace function enforce_one_level_subproject()
returns trigger
language plpgsql
as $$
begin
  if new.parent_project_id is not null then
    -- The chosen parent must not itself be a sub-project.
    if exists (
      select 1 from projects p
      where p.id = new.parent_project_id
        and p.parent_project_id is not null
    ) then
      raise exception 'Sub-projects are one level only: parent % is already a sub-project', new.parent_project_id;
    end if;
    -- A project that already has children cannot become a sub-project.
    if exists (
      select 1 from projects c
      where c.parent_project_id = new.id
    ) then
      raise exception 'Project % has sub-projects and cannot itself become a sub-project', new.id;
    end if;
  end if;
  return new;
end;
$$;

create trigger projects_one_level_subproject
  before insert or update of parent_project_id on projects
  for each row execute function enforce_one_level_subproject();

commit;
