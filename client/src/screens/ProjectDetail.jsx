// Project Detail — View mode (PRD §10). Read-only: nothing here is editable
// (§10.4). Same skeleton Edit mode will reuse in Phase 4. Layout top-to-bottom:
// summary band, objective, detail status filter, milestone blocks (header + task
// table with each task's update thread), project-level tasks, files strip,
// sub-project links. Target date is derived and read-only, badged AUTO (§12.2).

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, STATUSES } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Avatar from '../components/Avatar.jsx';
import TaskUpdateThread from '../components/TaskUpdateThread.jsx';

const OBJECTIVE_CLAMP = 180; // chars before the "More ›" expander kicks in (§10.2)

function TaskTable({ tasks }) {
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

export default function ProjectDetail({ projectId, onNavigate }) {
  const { profile } = useAuth();
  const [data, setData] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [objExpanded, setObjExpanded] = useState(false);
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.value)));
  const [toast, setToast] = useState('');

  useEffect(() => {
    let active = true;
    setData(null);
    setLoadError('');
    api
      .getProject(projectId)
      .then((d) => active && setData(d))
      .catch((e) => active && setLoadError(e.message || 'Could not load the project.'));
    return () => {
      active = false;
    };
  }, [projectId]);

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

  const project = data?.project;
  const canEdit = project && (profile?.role === 'admin' || project.owner_user_id === profile?.id);

  // Breadcrumb (§7.1): Projects › [parent ›] current.
  const title = useMemo(() => {
    if (!project) return null;
    return (
      <span className="breadcrumb">
        <button type="button" className="crumb-link" onClick={() => onNavigate({ name: 'list' })}>
          Projects
        </button>
        {project.parent_project_id && (
          <>
            <span className="crumb-sep">›</span>
            <button
              type="button"
              className="crumb-link"
              onClick={() => onNavigate({ name: 'detail', id: project.parent_project_id })}
            >
              {project.parent_name ?? 'Parent'}
            </button>
          </>
        )}
        <span className="crumb-sep">›</span>
        <span className="crumb-current">{project.name}</span>
      </span>
    );
  }, [project, onNavigate]);

  // View/Edit toggle (§7.1/§10.4). Viewer sees View only; Edit comes in Phase 4.
  const toggle = (
    <div className="view-edit-toggle" role="group" aria-label="View or edit">
      <button type="button" className="seg active" aria-pressed="true" title="View mode">
        👁 View
      </button>
      {canEdit && (
        <button
          type="button"
          className="seg"
          aria-pressed="false"
          title="Edit mode"
          onClick={() => setToast('Edit mode arrives in Phase 4.')}
        >
          ✎ Edit
        </button>
      )}
    </div>
  );

  return (
    <AppShell title={title} actions={project ? toggle : null}>
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
          {/* Summary band (§10.2) */}
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
          </section>

          {/* Objective with More › expander (§10.2) */}
          {project.objective && (
            <section className="objective">
              <h2 className="section-title">Objective</h2>
              {project.objective.length > OBJECTIVE_CLAMP && !objExpanded ? (
                <p>
                  {project.objective.slice(0, OBJECTIVE_CLAMP)}…{' '}
                  <button type="button" className="link-button" onClick={() => setObjExpanded(true)}>
                    More ›
                  </button>
                </p>
              ) : (
                <p>{project.objective}</p>
              )}
            </section>
          )}

          {/* Detail status filter (§10.2) */}
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

          {/* Milestone blocks (§10.2) */}
          {data.milestones
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
                    <TaskTable tasks={visible} />
                  ) : (
                    <p className="muted empty-line">No tasks.</p>
                  )}
                </section>
              );
            })}

          {/* Project-level tasks (§10.2) */}
          {(() => {
            const visible = data.projectTasks.filter(taskVisible);
            if (visible.length === 0) return null;
            return (
              <section className="milestone-block">
                <header className="milestone-header">
                  <h3 className="milestone-name">Project tasks</h3>
                </header>
                <TaskTable tasks={visible} />
              </section>
            );
          })()}

          {data.milestones.length === 0 && data.projectTasks.length === 0 && (
            <p className="muted">No milestones or tasks yet.</p>
          )}

          {/* Additional files (§10.2/§15) — read-only strip; viewer in Phase 5. */}
          {data.files.length > 0 && (
            <section className="strip">
              <h2 className="section-title">Additional Files</h2>
              <ul className="file-strip">
                {data.files.map((f) => (
                  <li key={f.id} className="file-chip" title={`${f.file_type} · ${f.size_bytes} bytes`}>
                    📎 {f.file_name}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Sub-projects (§10.2/§14) — links into the same detail screen. */}
          {data.subProjects.length > 0 && (
            <section className="strip">
              <h2 className="section-title">Sub Projects</h2>
              <ul className="subproject-strip">
                {data.subProjects.map((sp) => (
                  <li key={sp.id}>
                    <button
                      type="button"
                      className="subproject-link"
                      onClick={() => onNavigate({ name: 'detail', id: sp.id })}
                    >
                      {sp.name}
                      <StatusChip status={sp.status} />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </AppShell>
  );
}
