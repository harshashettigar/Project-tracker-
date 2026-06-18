// Project list — the home screen (PRD §9). Shows the projects the caller may see
// (own + mapped; admins all — enforced by RLS server-side), with client-side
// search/owner/status filtering over that visible set (§9.5), the create-project
// modal (§9.4), and the empty / empty-results states (§19.2).

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import { formatDate, STATUSES } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Avatar from '../components/Avatar.jsx';
import NewProjectModal from '../components/NewProjectModal.jsx';

const ALL_OWNERS = '__all__';

export default function ProjectList({ onOpen, onEdit, onAdmin }) {
  const { profile } = useAuth();
  const canCreate = profile?.role !== 'viewer'; // PRD §18

  const [projects, setProjects] = useState(null); // null = loading
  const [users, setUsers] = useState([]);
  const [loadError, setLoadError] = useState('');

  // Filters (§9.5). Status starts with all selected (= no status filter).
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState(ALL_OWNERS);
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.value)));

  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    setLoadError('');
    try {
      const [p, u] = await Promise.all([api.listProjects(), api.listUsers()]);
      setProjects(p);
      setUsers(u);
    } catch (err) {
      setLoadError(err.message || 'Could not load projects.');
      setProjects([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  // Owner dropdown options are the owners actually present in the visible list.
  const ownerOptions = useMemo(() => {
    const map = new Map();
    for (const p of projects || []) {
      if (p.owner_user_id && !map.has(p.owner_user_id)) map.set(p.owner_user_id, p.owner_name);
    }
    return [...map.entries()].sort((a, b) => (a[1] || '').localeCompare(b[1] || ''));
  }, [projects]);

  const statusAllSelected = statuses.size === STATUSES.length;

  // Search + owner + status combine with AND (§9.5).
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (projects || []).filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (owner !== ALL_OWNERS && p.owner_user_id !== owner) return false;
      if (!statusAllSelected && !statuses.has(p.status)) return false;
      return true;
    });
  }, [projects, search, owner, statuses, statusAllSelected]);

  const hasActiveFilters = search.trim() || owner !== ALL_OWNERS || !statusAllSelected;

  function toggleStatus(value) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return next;
    });
  }

  function clearFilters() {
    setSearch('');
    setOwner(ALL_OWNERS);
    setStatuses(new Set(STATUSES.map((s) => s.value)));
  }

  async function handleCreate(payload) {
    const project = await api.createProject(payload);
    // PRD §9.4: a new project opens immediately in Edit mode so the owner can
    // begin adding milestones and tasks.
    if (onEdit) onEdit(project.id);
    else await load();
    return project;
  }

  const newProjectButton = canCreate ? (
    <button type="button" className="primary-button" onClick={() => setModalOpen(true)}>
      + New project
    </button>
  ) : null;

  return (
    <AppShell actions={newProjectButton} onAdmin={onAdmin}>
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}

      <div className="page-head">
        <h1>
          Projects{projects ? ` (${filtered.length})` : ''}
        </h1>
      </div>

      {loadError && (
        <p className="auth-error" role="alert">
          {loadError}
        </p>
      )}

      {/* Filter / search row (§9.5) */}
      {projects && projects.length > 0 && (
        <div className="filter-row">
          <input
            type="search"
            className="filter-search"
            placeholder="Search projects…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value={ALL_OWNERS}>All owners</option>
            {ownerOptions.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
          <div className="status-filter">
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
          </div>
          {hasActiveFilters && (
            <button type="button" className="link-button" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      {/* States */}
      {projects === null ? (
        <p className="muted">Loading…</p>
      ) : projects.length === 0 ? (
        // First-run empty state (§19.2).
        <div className="empty-state">
          <h2>No projects yet</h2>
          <p className="muted">
            {canCreate
              ? 'Create your first project to get started.'
              : 'Projects you can see will appear here.'}
          </p>
          {canCreate && (
            <button type="button" className="primary-button" onClick={() => setModalOpen(true)}>
              + New project
            </button>
          )}
        </div>
      ) : filtered.length === 0 ? (
        // Filters return nothing (§19.2).
        <div className="empty-state">
          <h2>No projects match</h2>
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <table className="project-table">
          <thead>
            <tr>
              <th className="num">Sl</th>
              <th>Project Name</th>
              <th>Start Date</th>
              <th>Target Date</th>
              <th>Status</th>
              <th>Responsible</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((p, i) => {
              const canEdit = profile?.role === 'admin' || p.owner_user_id === profile?.id;
              return (
                <tr key={p.id}>
                  <td className="num">{String(i + 1).padStart(2, '0')}</td>
                  <td className="project-name">
                    <button
                      type="button"
                      className="project-name-link"
                      title="Open in View mode"
                      onClick={() => onOpen?.(p.id)}
                    >
                      {p.name}
                    </button>
                  </td>
                  <td>{formatDate(p.start_date) ?? '—'}</td>
                  <td>{formatDate(p.target_date) ?? '— Not set'}</td>
                  <td>
                    <StatusChip status={p.status} />
                  </td>
                  <td>
                    <span className="owner-cell">
                      <Avatar name={p.owner_name} />
                      {p.owner_name ?? '—'}
                    </span>
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="icon-button"
                      title="Open in View mode"
                      onClick={() => onOpen?.(p.id)}
                    >
                      👁
                    </button>
                    {canEdit && (
                      <button
                        type="button"
                        className="icon-button"
                        title="Open in Edit mode"
                        onClick={() => onEdit?.(p.id)}
                      >
                        ✎
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {modalOpen && (
        <NewProjectModal
          profile={profile}
          users={users}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreate}
        />
      )}
    </AppShell>
  );
}
