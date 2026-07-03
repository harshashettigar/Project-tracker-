// Project list — the home screen (PRD §9). Shows the projects the caller may see
// (own + mapped; admins all — enforced by RLS server-side), with client-side
// search/owner/status filtering over that visible set (§9.5), the create-project
// modal (§9.4), and the empty / empty-results states (§19.2).

import { useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import { useCachedQuery } from '../lib/useCachedQuery.js';
import { prefetch, invalidate } from '../lib/cache.js';
import { formatDate, STATUSES } from '../lib/format.js';
import AppShell from '../components/AppShell.jsx';
import StatusChip from '../components/StatusChip.jsx';
import Avatar from '../components/Avatar.jsx';
import { ListSkeleton } from '../components/Skeleton.jsx';
import NewProjectModal from '../components/NewProjectModal.jsx';

const ALL_OWNERS = '__all__';

// A clickable column header that sorts the list. Shows ▲/▼ when it's the active
// sort column; the whole header is the button so it's an easy target.
function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort?.key === sortKey;
  const arrow = active ? (sort.dir === 'asc' ? '▲' : '▼') : '';
  return (
    <th>
      <button
        type="button"
        className={`th-sort ${active ? 'active' : ''}`}
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <span className="th-sort-arrow" aria-hidden="true">
          {arrow}
        </span>
      </button>
    </th>
  );
}

export default function ProjectList({ onOpen, onEdit, onAdmin }) {
  const { profile } = useAuth();
  const canCreate = profile?.role !== 'viewer'; // PRD §18

  // Active vs Archived tab (post-v1). Each has its own cache key so switching is
  // instant and they refresh independently.
  const [view, setView] = useState('active');
  const archivedView = view === 'archived';

  // Stale-while-revalidate: a revisit renders the cached list instantly and
  // refreshes in the background; only a cold first load shows the skeleton.
  const { data: projects, loading, error: loadError, reload } = useCachedQuery(
    archivedView ? 'projects:archived' : 'projects',
    () => api.listProjects(archivedView),
  );
  const { data: users } = useCachedQuery('users', api.listUsers);

  // Archive / restore a project, then refresh both tabs (the row moves between
  // them). Permission is enforced server-side; the UI only offers it to editors.
  async function setArchived(id, archived) {
    await api.updateProject(id, { archived });
    invalidate('projects');
    invalidate('projects:archived');
    await reload();
    setToast(archived ? 'Project archived.' : 'Project restored.');
  }

  // Filters (§9.5). Status starts with all selected (= no status filter).
  const [search, setSearch] = useState('');
  const [owner, setOwner] = useState(ALL_OWNERS);
  const [statuses, setStatuses] = useState(() => new Set(STATUSES.map((s) => s.value)));

  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState('');

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

  // Column sort (post-v1). Client-only over the filtered rows. Defaults to
  // Responsible (owner) ascending; click a header to sort asc, again for desc, a
  // third time to clear (falls back to the server's name order).
  const [sort, setSort] = useState({ key: 'owner_name', dir: 'asc' }); // or null
  const STATUS_ORDER = useMemo(
    () => Object.fromEntries(STATUSES.map((s, i) => [s.value, i])),
    [],
  );

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const { key, dir } = sort;
    const mult = dir === 'asc' ? 1 : -1;
    const val = (p) => {
      switch (key) {
        case 'name':
          return (p.name || '').toLowerCase();
        case 'owner_name':
          return (p.owner_name || '').toLowerCase();
        case 'status':
          return STATUS_ORDER[p.status] ?? 999; // canonical order, not alphabetical
        case 'start_date':
          return p.start_date || '';
        case 'target_date':
          return p.target_date || '';
        default:
          return '';
      }
    };
    const isEmpty = (v) => v === '' || v == null;
    return [...filtered].sort((a, b) => {
      const va = val(a);
      const vb = val(b);
      // Empty values (no date / no owner) always sort last, regardless of dir.
      if (isEmpty(va) && isEmpty(vb)) return 0;
      if (isEmpty(va)) return 1;
      if (isEmpty(vb)) return -1;
      if (va < vb) return -mult;
      if (va > vb) return mult;
      return 0;
    });
  }, [filtered, sort, STATUS_ORDER]);

  function toggleSort(key) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'asc' };
      if (prev.dir === 'asc') return { key, dir: 'desc' };
      return null; // third click clears the sort
    });
  }

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
    invalidate('projects'); // list cache is now stale — drop it so it refetches
    // PRD §9.4: a new project opens immediately in Edit mode so the owner can
    // begin adding milestones and tasks.
    if (onEdit) onEdit(project.id);
    else await reload();
    return project;
  }

  const newProjectButton = canCreate ? (
    <button type="button" className="topbar-cta" onClick={() => setModalOpen(true)}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
        <path d="M12 5v14M5 12h14" />
      </svg>
      New project
    </button>
  ) : null;

  return (
    <AppShell actions={newProjectButton} onAdmin={onAdmin} wide>
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

      {/* Active / Archived tabs (post-v1). */}
      <div className="list-tabs" role="group" aria-label="Active or archived projects">
        <button
          type="button"
          className={`list-tab ${!archivedView ? 'active' : ''}`}
          aria-pressed={!archivedView}
          onClick={() => setView('active')}
        >
          Active
        </button>
        <button
          type="button"
          className={`list-tab ${archivedView ? 'active' : ''}`}
          aria-pressed={archivedView}
          onClick={() => setView('archived')}
        >
          Archived
        </button>
      </div>

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
      {loading ? (
        <ListSkeleton />
      ) : projects.length === 0 ? (
        archivedView ? (
          <div className="empty-state">
            <h2>No archived projects</h2>
            <p className="muted">Projects you archive from the Active tab will appear here.</p>
          </div>
        ) : (
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
        )
      ) : filtered.length === 0 ? (
        // Filters return nothing (§19.2).
        <div className="empty-state">
          <h2>No projects match</h2>
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <table className="project-table project-list-table">
          <thead>
            <tr>
              <th className="num">Sl</th>
              <SortableTh label="Project Name" sortKey="name" sort={sort} onSort={toggleSort} />
              <SortableTh label="Start Date" sortKey="start_date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Target Date" sortKey="target_date" sort={sort} onSort={toggleSort} />
              <SortableTh label="Status" sortKey="status" sort={sort} onSort={toggleSort} />
              <SortableTh label="Responsible" sortKey="owner_name" sort={sort} onSort={toggleSort} />
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              // can_edit comes from the server (owner/admin/member); fall back to
              // the owner/admin check for safety if an older payload lacks it.
              const canEdit = p.can_edit ?? (profile?.role === 'admin' || p.owner_user_id === profile?.id);
              // Warm the detail cache on hover/focus so the click feels instant.
              const warm = () => prefetch(`project:${p.id}`, () => api.getProject(p.id));
              return (
                <tr key={p.id} onMouseEnter={warm} onFocus={warm}>
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
                  <td data-label="Start">{formatDate(p.start_date) ?? '—'}</td>
                  <td data-label="Target">{formatDate(p.target_date) ?? '— Not set'}</td>
                  <td data-label="Status">
                    <StatusChip status={p.status} />
                  </td>
                  <td data-label="Owner">
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
                    {canEdit && !archivedView && (
                      <button
                        type="button"
                        className="icon-button"
                        title="Open in Edit mode"
                        onClick={() => onEdit?.(p.id)}
                      >
                        ✎
                      </button>
                    )}
                    {canEdit && !archivedView && (
                      <button
                        type="button"
                        className="icon-button"
                        title="Archive project"
                        aria-label="Archive project"
                        onClick={() => setArchived(p.id, true)}
                      >
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <rect x="3" y="4" width="18" height="4" rx="1" />
                          <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8M9 12h6" />
                        </svg>
                      </button>
                    )}
                    {canEdit && archivedView && (
                      <button
                        type="button"
                        className="link-button"
                        title="Restore project"
                        onClick={() => setArchived(p.id, false)}
                      >
                        Restore
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
          users={users || []}
          onClose={() => setModalOpen(false)}
          onCreated={handleCreate}
        />
      )}
    </AppShell>
  );
}
