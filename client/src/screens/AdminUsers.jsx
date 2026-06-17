// Admin — User management, Users tab (PRD §16). Admin-only (the API enforces it;
// the account menu only shows the entry to admins). Full-width table styled like
// the project list, with search + role/status filters, invite/edit modal, and
// deactivate/reactivate with a self-guard.

import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { api } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import Avatar from '../components/Avatar.jsx';
import { RoleChip, UserStatusChip } from '../components/RoleChip.jsx';
import AdminUserModal from '../components/AdminUserModal.jsx';

const ROLES = ['admin', 'manager', 'member', 'viewer'];
const ALL_ROLES = '__all__';

export default function AdminUsers({ onNavigate }) {
  const { profile } = useAuth();
  const [users, setUsers] = useState(null); // null = loading
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState(ALL_ROLES);
  const [statuses, setStatuses] = useState(() => new Set(['active', 'inactive']));
  const [modal, setModal] = useState(null); // {mode:'add'} | {mode:'edit', user}
  const [toast, setToast] = useState('');

  async function load() {
    setLoadError('');
    try {
      setUsers(await api.adminListUsers());
    } catch (e) {
      setLoadError(e.message || 'Could not load users.');
      setUsers([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const statusAll = statuses.size === 2;
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (users || []).filter((u) => {
      if (q && !u.full_name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q))
        return false;
      if (roleFilter !== ALL_ROLES && u.role !== roleFilter) return false;
      if (!statusAll && !statuses.has(u.status)) return false;
      return true;
    });
  }, [users, search, roleFilter, statuses, statusAll]);

  const hasFilters = search.trim() || roleFilter !== ALL_ROLES || !statusAll;
  function clearFilters() {
    setSearch('');
    setRoleFilter(ALL_ROLES);
    setStatuses(new Set(['active', 'inactive']));
  }
  function toggleStatus(v) {
    setStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v);
      else next.add(v);
      return next;
    });
  }

  async function createUser(payload) {
    await api.adminCreateUser(payload);
    await load();
    setToast('Invite sent.');
  }
  async function editUser(payload) {
    await api.adminUpdateUser(modal.user.id, payload);
    await load();
    setToast('User updated.');
  }
  async function setStatusFor(u, status) {
    if (status === 'inactive' && !window.confirm(`Deactivate ${u.full_name}?`)) return;
    try {
      await api.adminUpdateUser(u.id, { status });
      await load();
      setToast(status === 'inactive' ? 'User deactivated.' : 'User reactivated.');
    } catch (e) {
      setToast(e.message || 'Could not update status.');
    }
  }

  const title = (
    <span className="breadcrumb">
      <button type="button" className="crumb-link" onClick={() => onNavigate({ name: 'list' })}>
        Projects
      </button>
      <span className="crumb-sep">›</span>
      <span className="crumb-current">Admin · Users</span>
    </span>
  );
  const addButton = (
    <button type="button" className="primary-button" onClick={() => setModal({ mode: 'add' })}>
      + Add user
    </button>
  );

  return (
    <AppShell title={title} actions={addButton}>
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}

      <div className="page-head">
        <h1>Users{users ? ` (${filtered.length})` : ''}</h1>
      </div>

      {loadError && (
        <p className="auth-error" role="alert">
          {loadError}
        </p>
      )}

      {users && users.length > 0 && (
        <div className="filter-row">
          <input
            type="search"
            className="filter-search"
            placeholder="Search name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)}>
            <option value={ALL_ROLES}>All roles</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r[0].toUpperCase() + r.slice(1)}
              </option>
            ))}
          </select>
          <div className="status-filter">
            {['active', 'inactive'].map((s) => (
              <button
                key={s}
                type="button"
                className={`chip ustatus-${s} toggle ${statuses.has(s) ? 'on' : 'off'}`}
                aria-pressed={statuses.has(s)}
                onClick={() => toggleStatus(s)}
              >
                <span className="chip-dot" aria-hidden="true" />
                {s === 'active' ? 'Active' : 'Inactive'}
              </button>
            ))}
          </div>
          {hasFilters && (
            <button type="button" className="link-button" onClick={clearFilters}>
              Clear all
            </button>
          )}
        </div>
      )}

      {users === null ? (
        <p className="muted">Loading…</p>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <h2>No users yet</h2>
          <p className="muted">Invite your first teammate to get started.</p>
          <button type="button" className="primary-button" onClick={() => setModal({ mode: 'add' })}>
            + Add user
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <h2>No users match</h2>
          <button type="button" className="link-button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <table className="project-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Mapped</th>
              <th aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const isSelf = u.id === profile?.id;
              return (
                <tr key={u.id}>
                  <td>
                    <span className="owner-cell">
                      <Avatar name={u.full_name} />
                      {u.full_name}
                    </span>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <RoleChip role={u.role} />
                  </td>
                  <td>
                    <UserStatusChip status={u.status} />
                  </td>
                  <td>
                    {u.mapped_count > 0 ? (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setToast('Mappings — coming in Phase 8.')}
                      >
                        {u.mapped_count}
                      </button>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="row-actions">
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => setModal({ mode: 'edit', user: u })}
                    >
                      Edit
                    </button>
                    {u.status === 'active' ? (
                      <button
                        type="button"
                        className="link-button danger"
                        disabled={isSelf}
                        title={isSelf ? "You can't deactivate your own account" : ''}
                        onClick={() => setStatusFor(u, 'inactive')}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => setStatusFor(u, 'active')}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {modal && (
        <AdminUserModal
          user={modal.mode === 'edit' ? modal.user : null}
          onClose={() => setModal(null)}
          onSubmit={modal.mode === 'edit' ? editUser : createUser}
        />
      )}
    </AppShell>
  );
}
