// Project Detail — View and Edit modes (PRD §10 / §11). Same skeleton; a single
// toggle flips between read-only and editable (§10.4/§11.1). View mode surfaces
// the latest update per task and is non-editable; Edit mode (owner/admin) makes
// each region editable and adds the structure controls. Target date is always
// derived and read-only (§12.2). Capability is enforced server/DB-side; the mode
// only decides what to render.

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, STATUSES } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Avatar from '../components/Avatar.jsx';
import TaskUpdateThread from '../components/TaskUpdateThread.jsx';
import FilesSection from '../components/FilesSection.jsx';
import MembersSection from '../components/MembersSection.jsx';
import SubProjectRow from '../components/SubProjectRow.jsx';
import SummaryEditor from '../components/edit/SummaryEditor.jsx';
import SubProjectsEditor from '../components/edit/SubProjectsEditor.jsx';
import MilestoneEditor from '../components/edit/MilestoneEditor.jsx';
import AddMilestoneForm from '../components/edit/AddMilestoneForm.jsx';
import AddTaskForm from '../components/edit/AddTaskForm.jsx';
import TaskEditor from '../components/edit/TaskEditor.jsx';

const OBJECTIVE_CLAMP = 180; // chars before the "More ›" expander kicks in (§10.2)

function ReadTaskTable({ tasks }) {
  return (
    <table className="task-table">
      <thead>
        <tr>
          <th>Task Name</th>
          <th>Start</th>
          <th>Target</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {tasks.map((t) => (
          <Fragment key={t.id}>
            <tr>
              <td className="task-name">{t.name}</td>
              <td>{formatDate(t.start_date) ?? '—'}</td>
              <td>{formatDate(t.target_date) ?? '—'}</td>
              <td>
                <StatusChip status={t.status} />
              </td>
            </tr>
            <tr className="update-row">
              <td colSpan={4}>
                <TaskUpdateThread updates={t.updates} />
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
  const [data, setData] = useState(null); // null = loading
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [mode, setMode] = useState(initialMode);
  const [objExpanded, setObjExpanded] = useState(false);
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.value)));
  const [toast, setToast] = useState('');

  const reload = useCallback(async () => {
    const d = await api.getProject(projectId);
    setData(d);
    return d;
  }, [projectId]);

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError('');
    Promise.all([api.getProject(projectId), api.listUsers().catch(() => [])])
      .then(([d, u]) => {
        if (!active) return;
        setData(d);
        setUsers(u);
      })
      .catch((e) => active && setLoadError(e.message || 'Could not load the project.'));
    return () => {
      active = false;
    };
  }, [projectId]);

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

  // Reorder siblings by renumbering sort_order to array position, then reload.
  async function move(list, index, dir, patchFn) {
    const to = index + dir;
    if (to < 0 || to >= list.length) return;
    const arr = [...list];
    const [moved] = arr.splice(index, 1);
    arr.splice(to, 0, moved);
    await Promise.all(arr.map((it, i) => patchFn(it.id, { sort_order: i })));
    await reload();
  }
  const moveMilestone = (index, dir) => move(data.milestones, index, dir, api.updateMilestone);
  const moveTask = (list, index, dir) => move(list, index, dir, api.updateTask);

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

      {data === null && !loadError && <p className="muted">Loading…</p>}

      {project && (
        <>
          {editing ? (
            <SummaryEditor project={project} users={users} reload={reload} />
          ) : (
            <>
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

          {/* Members (members extension) — additional view+edit users beyond the
              owner. Read-only list in View; add/remove in Edit. */}
          <MembersSection
            projectId={project.id}
            ownerUserId={project.owner_user_id}
            members={data.members || []}
            users={users}
            editing={editing}
            reload={reload}
          />

          {/* Milestone blocks */}
          {editing
            ? data.milestones.map((m, i) => (
                <MilestoneEditor
                  key={m.id}
                  projectId={project.id}
                  milestone={m}
                  index={i}
                  count={data.milestones.length}
                  onMove={(dir) => moveMilestone(i, dir)}
                  onMoveTask={moveTask}
                  reload={reload}
                />
              ))
            : data.milestones
                .filter((m) => statusAllSelected || statuses.has(m.status) || m.tasks.some(taskVisible))
                .map((m) => {
                  const visible = m.tasks.filter(taskVisible);
                  return (
                    <section className="milestone-block" key={m.id}>
                      <header className="milestone-header">
                        <h3 className="milestone-name">{m.name}</h3>
                        <span className="milestone-target">Target {formatDate(m.target_date)}</span>
                        <StatusChip status={m.status} />
                      </header>
                      {visible.length > 0 ? (
                        <ReadTaskTable tasks={visible} />
                      ) : (
                        <p className="muted empty-line">No tasks.</p>
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
                {data.projectTasks.map((t, i) => (
                  <TaskEditor
                    key={t.id}
                    task={t}
                    targetRequired
                    index={i}
                    count={data.projectTasks.length}
                    onMove={(dir) => moveTask(data.projectTasks, i, dir)}
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
              const visible = data.projectTasks.filter(taskVisible);
              if (visible.length === 0) return null;
              return (
                <section className="milestone-block">
                  <header className="milestone-header">
                    <h3 className="milestone-name">Project tasks</h3>
                  </header>
                  <ReadTaskTable tasks={visible} />
                </section>
              );
            })()
          )}

          {!editing && data.milestones.length === 0 && data.projectTasks.length === 0 && (
            <p className="muted">No milestones or tasks yet.</p>
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
        </>
      )}
    </AppShell>
  );
}
