// Project Detail — View and Edit modes (PRD §10 / §11). Same skeleton; a single
// toggle flips between read-only and editable (§10.4/§11.1). View mode surfaces
// the latest update per task and is non-editable; Edit mode (owner/admin) makes
// each region editable and adds the structure controls. Target date is always
// derived and read-only (§12.2). Capability is enforced server/DB-side; the mode
// only decides what to render.

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import { useCachedQuery } from '../lib/useCachedQuery.js';
import { usePeriod, inRange } from '../period/PeriodContext.jsx';
import { formatDate, STATUSES } from '../lib/format.js';
import { DetailSkeleton } from '../components/Skeleton.jsx';
import AppShell from '../components/AppShell.jsx';
import StatusChip from '../components/StatusChip.jsx';
import PriorityChip from '../components/PriorityChip.jsx';
import Avatar from '../components/Avatar.jsx';
import TaskUpdateThread from '../components/TaskUpdateThread.jsx';
import FilesSection from '../components/FilesSection.jsx';
import MembersSection from '../components/MembersSection.jsx';
import SubProjectRow from '../components/SubProjectRow.jsx';
import InfoPopover from '../components/InfoPopover.jsx';
import SummaryEditor from '../components/edit/SummaryEditor.jsx';
import SubProjectsEditor from '../components/edit/SubProjectsEditor.jsx';
import MilestoneEditor from '../components/edit/MilestoneEditor.jsx';
import AddMilestoneForm from '../components/edit/AddMilestoneForm.jsx';
import AddTaskForm from '../components/edit/AddTaskForm.jsx';
import TaskEditor from '../components/edit/TaskEditor.jsx';

const OBJECTIVE_CLAMP = 180; // chars before the "More ›" expander kicks in (§10.2)
const PROJECT_TASKS_KEY = '__project_tasks__'; // expand/collapse key for the project-level group

function ReadTaskTable({ tasks, range }) {
  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task Name</th>
          <th>Start</th>
          <th>Target</th>
          <th>Status</th>
          <th>Priority</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <Fragment key={t.id}>
            <tr>
              <td className="task-name">
                <span className="name-with-info">
                  {t.name}
                  <InfoPopover text={t.description} label="task description" />
                </span>
              </td>
              <td data-label="Start">{formatDate(t.start_date) ?? '—'}</td>
              <td data-label="Target">{formatDate(t.target_date) ?? '—'}</td>
              <td data-label="Status">
                <StatusChip status={t.status} />
              </td>
              <td data-label="Priority">
                <PriorityChip priority={t.priority || 'mid'} />
              </td>
            </tr>
            <tr className="update-row">
              <td colSpan={5}>
                <TaskUpdateThread updates={t.updates} range={range} />
              </td>
            </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}

export default function ProjectDetail({ projectId, initialMode = 'view', onNavigate, onAdmin }) {
  const { profile } = useAuth();
  // Stale-while-revalidate: a prefetched/previously-seen project renders instantly
  // (no blank), then refreshes in the background. `reload` forces a fresh fetch and
  // is what the editors call after a mutation. Cold loads show the skeleton.
  const { data, loading, error: loadError, reload, mutate } = useCachedQuery(
    `project:${projectId}`,
    () => api.getProject(projectId),
  );
  const { data: usersData } = useCachedQuery('users', api.listUsers);
  const users = usersData || [];
  const { range, onlyUpdated } = usePeriod();

  // Review-period summary (View mode): how many tasks got an update in the window.
  const periodStats = useMemo(() => {
    if (!range || !data) return null;
    let tasks = 0;
    let updates = 0;
    // Active tasks only — archived items (and tasks under archived milestones) are
    // out of view, so they don't count toward the review summary.
    const allTasks = [
      ...data.milestones.filter((m) => !m.archived_at).flatMap((m) => m.tasks.filter((t) => !t.archived_at)),
      ...data.projectTasks.filter((t) => !t.archived_at),
    ];
    for (const t of allTasks) {
      const n = (t.updates || []).filter((u) => inRange(u.created_at, range)).length;
      if (n > 0) {
        tasks += 1;
        updates += n;
      }
    }
    return { tasks, updates };
  }, [range, data]);
  const [mode, setMode] = useState(initialMode);
  const [objExpanded, setObjExpanded] = useState(false);
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.value)));
  const [toast, setToast] = useState('');

  const project = data?.project;
  // Members can view + fully edit too (members extension), so they count toward
  // edit capability alongside owner/admin. RLS is the real gate; this just
  // decides what the UI offers.
  const isMember = !!data?.members?.some((m) => m.user_id === profile?.id);
  const canEdit =
    project && (profile?.role === 'admin' || project.owner_user_id === profile?.id || isMember);
  const editing = mode === 'edit' && canEdit;

  // If a non-owner somehow lands in edit mode, fall back to view.
  useEffect(() => {
    if (mode === 'edit' && project && !canEdit) setMode('view');
  }, [mode, project, canEdit]);

  // Archive (post-v1) splits each level into active (shown normally) and archived
  // (moved into the "Archived" section). An archived milestone takes its whole
  // subtree with it; an archived task whose milestone is still active is listed on
  // its own. Reordering operates on the ACTIVE sublist only — archived rows keep
  // their sort_order and re-slot when restored.
  const activeMilestones = (data?.milestones || []).filter((m) => !m.archived_at);
  const archivedMilestones = (data?.milestones || []).filter((m) => m.archived_at);
  const activeProjectTasks = (data?.projectTasks || []).filter((t) => !t.archived_at);
  // Archived tasks to surface in the Archived section: project-level ones, plus
  // tasks under a still-active milestone (those under an archived milestone travel
  // with it, so we don't list them separately).
  const archivedTasks = [
    ...(data?.projectTasks || []).filter((t) => t.archived_at),
    ...activeMilestones.flatMap((m) => m.tasks.filter((t) => t.archived_at)),
  ];
  const hasArchived = archivedMilestones.length > 0 || archivedTasks.length > 0;

  // Reorder one step. Optimistic: the UI updates instantly (mutate), and only the
  // rows whose position actually changed are PATCHed, in the BACKGROUND (no full
  // reload). This replaces the old "renumber every sibling + await a full reload"
  // path, which made each arrow click wait on N writes + a big GET.
  function reorderSiblings(list, index, dir) {
    const to = index + dir;
    if (to < 0 || to >= list.length) return null;
    const arr = [...list];
    const [moved] = arr.splice(index, 1);
    arr.splice(to, 0, moved);
    return arr.map((it, i) => ({ ...it, sort_order: i }));
  }

  function persistOrder(reordered, original, patchFn) {
    const prevById = new Map(original.map((it) => [it.id, it.sort_order]));
    const changed = reordered.filter((it) => prevById.get(it.id) !== it.sort_order);
    // Fire-and-forget; only resync from the server if a write fails.
    Promise.all(changed.map((it) => patchFn(it.id, { sort_order: it.sort_order }))).catch(() =>
      reload(),
    );
  }

  function moveMilestone(index, dir) {
    const reordered = reorderSiblings(activeMilestones, index, dir);
    if (!reordered) return;
    mutate({ ...data, milestones: [...reordered, ...archivedMilestones] });
    persistOrder(reordered, activeMilestones, api.updateMilestone);
  }

  function moveMilestoneTask(milestoneId, index, dir) {
    const m = data.milestones.find((x) => x.id === milestoneId);
    if (!m) return;
    const active = m.tasks.filter((t) => !t.archived_at);
    const archived = m.tasks.filter((t) => t.archived_at);
    const reordered = reorderSiblings(active, index, dir);
    if (!reordered) return;
    mutate({
      ...data,
      milestones: data.milestones.map((x) =>
        x.id === milestoneId ? { ...x, tasks: [...reordered, ...archived] } : x,
      ),
    });
    persistOrder(reordered, active, api.updateTask);
  }

  function moveProjectTask(index, dir) {
    const reordered = reorderSiblings(activeProjectTasks, index, dir);
    if (!reordered) return;
    mutate({ ...data, projectTasks: [...reordered, ...(data.projectTasks || []).filter((t) => t.archived_at)] });
    persistOrder(reordered, activeProjectTasks, api.updateTask);
  }

  // Archive / restore a milestone or task, then refresh the detail.
  async function setMilestoneArchived(id, archived) {
    await api.updateMilestone(id, { archived });
    await reload();
  }
  async function setTaskArchived(id, archived) {
    await api.updateTask(id, { archived });
    await reload();
  }

  const statusAllSelected = statuses.size === STATUSES.length;
  function toggleStatus(value) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }
  const taskVisible = (t) => statusAllSelected || statuses.has(t.status);

  // Review view (post-v1): milestones are collapsible (View mode); the top-bar
  // "Only updated" switch (global, via PeriodContext) narrows the page to what got
  // an update inside the active review period. Pure view concerns keyed off the
  // existing `range` + `inRange`.
  const [expandedIds, setExpandedIds] = useState(() => new Set()); // collapsed by default
  const periodActive = !!range;
  const onlyUpdatedActive = onlyUpdated && periodActive;

  const taskHasUpdateInRange = (t) =>
    periodActive && (t.updates || []).some((u) => inRange(u.created_at, range));
  // A task shows if it passes the status filter and — when the switch is on —
  // was updated inside the period. Highlight and filter use the same predicate.
  const taskVisibleFull = (t) => taskVisible(t) && (!onlyUpdatedActive || taskHasUpdateInRange(t));
  const milestoneMatches = (m) => {
    const visible = m.tasks.filter((t) => !t.archived_at && taskVisibleFull(t));
    if (onlyUpdatedActive) return visible.length > 0;
    return statusAllSelected || statuses.has(m.status) || visible.length > 0;
  };

  function toggleExpanded(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Default expansion is driven by the DATE SELECTOR (not the switch):
  //  - "All" (no window) → show the full picture: every milestone + the project
  //    group expanded.
  //  - A window (This week / custom) → review mode: collapse, then auto-expand
  //    only the milestones (and project group) that have an in-period update, so a
  //    reviewer sees exactly what changed without a click.
  // Applied once per period change (keyed below), so a manual expand/collapse
  // isn't clobbered by a background data refresh while the period is unchanged.
  const lastPeriodKey = useRef(null);
  useEffect(() => {
    if (!data) return;
    const key = range ? `${range.start.getTime()}-${range.end.getTime()}` : 'all';
    if (lastPeriodKey.current === key) return; // same period → keep manual state
    lastPeriodKey.current = key;

    const ids = new Set();
    if (!range) {
      // "All": expand everything.
      for (const m of data.milestones || []) if (!m.archived_at) ids.add(m.id);
      ids.add(PROJECT_TASKS_KEY);
    } else {
      // Window: expand only what has an in-period update.
      const has = (t) => (t.updates || []).some((u) => inRange(u.created_at, range));
      for (const m of data.milestones || []) {
        if (!m.archived_at && m.tasks.some((t) => !t.archived_at && has(t))) ids.add(m.id);
      }
      if ((data.projectTasks || []).some((t) => !t.archived_at && has(t))) ids.add(PROJECT_TASKS_KEY);
    }
    setExpandedIds(ids);
  }, [range, data]);

  // Breadcrumb (§7.1): the "Project Tracker" brand in the top bar is the home
  // link, so the title is just [parent /] current project name.
  const title = useMemo(() => {
    if (!project) return null;
    return (
      <span className="breadcrumb">
        {project.parent_project_id && (
          <>
            <button
              type="button"
              className="crumb-link"
              onClick={() => onNavigate({ name: 'detail', id: project.parent_project_id })}
            >
              {project.parent_name ?? 'Parent'}
            </button>
            <span className="crumb-sep">/</span>
          </>
        )}
        <span className="crumb-current">{project.name}</span>
      </span>
    );
  }, [project, onNavigate]);

  // View/Edit toggle (§7.1/§10.4). Viewer (and non-owners) see View only.
  const toggle = (
    <div className="view-edit-toggle" role="group" aria-label="View or edit">
      <button
        type="button"
        className={`seg ${!editing ? 'active' : ''}`}
        aria-pressed={!editing}
        onClick={() => setMode('view')}
      >
        👁 View
      </button>
      {canEdit && (
        <button
          type="button"
          className={`seg ${editing ? 'active' : ''}`}
          aria-pressed={editing}
          onClick={() => setMode('edit')}
        >
          ✎ Edit
        </button>
      )}
    </div>
  );

  return (
    <AppShell
      title={title}
      actions={project ? toggle : null}
      onAdmin={onAdmin}
      onHome={() => onNavigate({ name: 'list' })}
    >
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}

      {loadError && (
        <p className="auth-error" role="alert">
          {loadError}
        </p>
      )}

      {loading && !loadError && <DetailSkeleton />}

      {project && (
        <>
          {editing ? (
            <SummaryEditor project={project} users={users} reload={reload} />
          ) : (
            <>
              {/* Review-period summary — the "Only updated" switch itself lives in
                  the top bar (global). Milestones with an in-period update
                  auto-expand regardless of the switch. */}
              {periodStats && (
                <p className="period-summary">
                  {periodStats.tasks === 0
                    ? 'No task updates in the selected period.'
                    : `${periodStats.tasks} ${periodStats.tasks === 1 ? 'task' : 'tasks'} updated · ${periodStats.updates} ${periodStats.updates === 1 ? 'update' : 'updates'} in the selected period.`}
                </p>
              )}

              {/* Summary band (§10.2) — objective lives inside this white card. */}
              <section className="summary-band">
                <h1 className="summary-name">{project.name}</h1>
                <div className="summary-facts">
                  <div className="fact">
                    <span className="fact-label">Start</span>
                    <span>{formatDate(project.start_date) ?? '—'}</span>
                  </div>
                  <div className="fact">
                    <span className="fact-label">Target</span>
                    <span>
                      {formatDate(project.target_date) ?? '— Not set'}
                      <span className="auto-badge" title="Derived from milestones & tasks">
                        AUTO
                      </span>
                    </span>
                  </div>
                  <div className="fact">
                    <span className="fact-label">Status</span>
                    <StatusChip status={project.status} />
                  </div>
                  <div className="fact">
                    <span className="fact-label">Responsible</span>
                    <span className="owner-cell">
                      <Avatar name={project.owner_name} />
                      {project.owner_name ?? '—'}
                    </span>
                  </div>
                </div>

                {/* Objective with More › expander (§10.2), divided from the facts. */}
                {project.objective && (
                  <div className="summary-objective">
                    <h2 className="section-title">Objective</h2>
                    {project.objective.length > OBJECTIVE_CLAMP && !objExpanded ? (
                      <p>
                        {project.objective.slice(0, OBJECTIVE_CLAMP)}…{' '}
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => setObjExpanded(true)}
                        >
                          More ›
                        </button>
                      </p>
                    ) : (
                      <p>{project.objective}</p>
                    )}
                  </div>
                )}
              </section>

              {/* Detail status filter (§10.2) — View mode only */}
              <div className="status-filter detail-filter">
                {STATUSES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    className={`chip status-${s.value} toggle ${statuses.has(s.value) ? 'on' : 'off'}`}
                    aria-pressed={statuses.has(s.value)}
                    onClick={() => toggleStatus(s.value)}
                  >
                    <span className="chip-dot" aria-hidden="true" />
                    {s.label}
                  </button>
                ))}
                {!statusAllSelected && (
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => setStatuses(new Set(STATUSES.map((s) => s.value)))}
                  >
                    Clear
                  </button>
                )}
              </div>

            </>
          )}

          {/* Milestone blocks (archived ones move to the Archived section) */}
          {editing
            ? activeMilestones.map((m, i) => (
                <MilestoneEditor
                  key={m.id}
                  projectId={project.id}
                  milestone={{ ...m, tasks: m.tasks.filter((t) => !t.archived_at) }}
                  index={i}
                  count={activeMilestones.length}
                  onMove={(dir) => moveMilestone(i, dir)}
                  onMoveTask={moveMilestoneTask}
                  onArchive={() => setMilestoneArchived(m.id, true)}
                  onArchiveTask={(taskId) => setTaskArchived(taskId, true)}
                  reload={reload}
                />
              ))
            : activeMilestones.filter(milestoneMatches).map((m) => {
                const activeTasks = m.tasks.filter((t) => !t.archived_at);
                const visible = activeTasks.filter(taskVisibleFull);
                const updatedCount = periodActive
                  ? activeTasks.filter(taskHasUpdateInRange).length
                  : null;
                const isOpen = expandedIds.has(m.id);
                const bodyId = `m-body-${m.id}`;
                return (
                  <section className="milestone-block milestone" key={m.id}>
                    <header className="milestone-header collapsible">
                      <h3 className="milestone-name">
                        <button
                          type="button"
                          className="milestone-toggle"
                          aria-expanded={isOpen}
                          aria-controls={bodyId}
                          onClick={() => toggleExpanded(m.id)}
                        >
                          <span className="chevron" aria-hidden="true">
                            ▸
                          </span>
                          {m.name}
                        </button>
                      </h3>
                      <InfoPopover text={m.description} label="milestone description" />
                      <span className="milestone-target">Target {formatDate(m.target_date)}</span>
                      <StatusChip status={m.status} />
                      <span className="milestone-badge">
                        {visible.length} {visible.length === 1 ? 'task' : 'tasks'}
                        {updatedCount != null && ` · ${updatedCount} updated`}
                      </span>
                    </header>
                    {isOpen && (
                      <div id={bodyId}>
                        {visible.length > 0 ? (
                          <ReadTaskTable tasks={visible} range={range} />
                        ) : (
                          <p className="muted empty-line">No tasks.</p>
                        )}
                      </div>
                    )}
                  </section>
                );
              })}

          {editing && <AddMilestoneForm projectId={project.id} reload={reload} />}

          {/* Project-level tasks */}
          {editing ? (
            <section className="milestone-block">
              <header className="milestone-header">
                <h3 className="milestone-name">Project tasks</h3>
              </header>
              <div className="milestone-tasks">
                {activeProjectTasks.map((t, i) => (
                  <TaskEditor
                    key={t.id}
                    task={t}
                    targetRequired
                    index={i}
                    count={activeProjectTasks.length}
                    onMove={(dir) => moveProjectTask(i, dir)}
                    onArchive={() => setTaskArchived(t.id, true)}
                    reload={reload}
                  />
                ))}
                <AddTaskForm
                  targetRequired
                  onAdd={(payload) => api.addTask(project.id, payload).then(reload)}
                />
              </div>
            </section>
          ) : (
            (() => {
              const visible = activeProjectTasks.filter(taskVisibleFull);
              if (visible.length === 0) return null;
              const updatedCount = periodActive
                ? activeProjectTasks.filter(taskHasUpdateInRange).length
                : null;
              const isOpen = expandedIds.has(PROJECT_TASKS_KEY);
              const bodyId = 'm-body-project-tasks';
              return (
                <section className="milestone-block">
                  <header className="milestone-header collapsible">
                    <h3 className="milestone-name">
                      <button
                        type="button"
                        className="milestone-toggle"
                        aria-expanded={isOpen}
                        aria-controls={bodyId}
                        onClick={() => toggleExpanded(PROJECT_TASKS_KEY)}
                      >
                        <span className="chevron" aria-hidden="true">
                          ▸
                        </span>
                        Project tasks
                      </button>
                    </h3>
                    <span className="milestone-badge">
                      {visible.length} {visible.length === 1 ? 'task' : 'tasks'}
                      {updatedCount != null && ` · ${updatedCount} updated`}
                    </span>
                  </header>
                  {isOpen && (
                    <div id={bodyId}>
                      <ReadTaskTable tasks={visible} range={range} />
                    </div>
                  )}
                </section>
              );
            })()
          )}

          {/* Filter-empty state: a window + switch are on but nothing matches. */}
          {!editing &&
            onlyUpdatedActive &&
            !activeMilestones.some(milestoneMatches) &&
            !activeProjectTasks.some(taskVisibleFull) && (
              <p className="muted">No tasks were updated in this period.</p>
            )}

          {!editing && activeMilestones.length === 0 && activeProjectTasks.length === 0 && !hasArchived && (
            <p className="muted">No milestones or tasks yet.</p>
          )}

          {/* Archived section (post-v1): archived milestones + tasks, with Restore
              (when the caller can edit). An archived milestone carries its tasks. */}
          {hasArchived && (
            <section className="milestone-block archived-section">
              <header className="milestone-header">
                <h3 className="milestone-name">Archived</h3>
                <span className="muted archived-count">
                  {archivedMilestones.length + archivedTasks.length} item
                  {archivedMilestones.length + archivedTasks.length === 1 ? '' : 's'}
                </span>
              </header>
              <ul className="archived-list">
                {archivedMilestones.map((m) => (
                  <li className="archived-row" key={`m-${m.id}`}>
                    <span className="archived-kind">Milestone</span>
                    <span className="archived-name">{m.name}</span>
                    <StatusChip status={m.status} />
                    {canEdit && (
                      <button
                        type="button"
                        className="link-button archived-restore"
                        onClick={() => setMilestoneArchived(m.id, false)}
                      >
                        Restore
                      </button>
                    )}
                  </li>
                ))}
                {archivedTasks.map((t) => (
                  <li className="archived-row" key={`t-${t.id}`}>
                    <span className="archived-kind">Task</span>
                    <span className="archived-name">{t.name}</span>
                    <StatusChip status={t.status} />
                    {canEdit && (
                      <button
                        type="button"
                        className="link-button archived-restore"
                        onClick={() => setTaskArchived(t.id, false)}
                      >
                        Restore
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Files + Sub-projects sit side-by-side (reference design), collapsing
              to one column on narrow screens. */}
          <div className="detail-cards-grid">
            {/* Additional files (§10.2/§15): in-app viewer; attach/remove in Edit. */}
            <FilesSection projectId={project.id} files={data.files} editing={editing} reload={reload} />

            {/* Sub-projects (§10.2/§14): read-only links in View; manage in Edit. */}
            {editing ? (
              <SubProjectsEditor
                project={project}
                subProjects={data.subProjects}
                onNavigate={onNavigate}
                reload={reload}
              />
            ) : (
              data.subProjects.length > 0 && (
                <section className="strip detail-card">
                  <h2 className="section-title">Sub-projects</h2>
                  <ul className="subproject-list">
                    {data.subProjects.map((sp) => (
                      <SubProjectRow
                        key={sp.id}
                        sub={sp}
                        onOpen={() => onNavigate({ name: 'detail', id: sp.id })}
                      />
                    ))}
                  </ul>
                </section>
              )
            )}
          </div>

          {/* Members (members extension) — additional view+edit users beyond the
              owner. Kept at the bottom so status/tasks sit higher on the page.
              Read-only list in View; add/remove in Edit. */}
          <MembersSection
            projectId={project.id}
            ownerUserId={project.owner_user_id}
            members={data.members || []}
            users={users}
            editing={editing}
            reload={reload}
          />
        </>
      )}
    </AppShell>
  );
}
