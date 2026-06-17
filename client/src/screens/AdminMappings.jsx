// Admin — Visibility mappings (PRD §17). A mapping grants a viewer visibility
// into all projects owned by another user (an "employee"), in addition to their
// own. Left: searchable user picker with each user's mapped count. Main: the
// selected user's mapping panel — plain-language summary, removable mapped
// employees (name + project count), and a search-and-select to add more
// (excludes self + already-mapped). Below: an overview/audit table (§17.4).

import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import AppShell from '../components/AppShell.jsx';
import Avatar from '../components/Avatar.jsx';
import AdminTabs from '../components/AdminTabs.jsx';

export default function AdminMappings({ onNavigate, focusUserId }) {
  const [data, setData] = useState(null); // { users, mappings } | null
  const [loadError, setLoadError] = useState('');
  const [selectedId, setSelectedId] = useState(focusUserId || null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [addSearch, setAddSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function load() {
    setLoadError('');
    try {
      setData(await api.adminGetMappings());
    } catch (e) {
      setLoadError(e.message || 'Could not load mappings.');
      setData({ users: [], mappings: [] });
    }
  }
  useEffect(() => {
    load();
  }, []);

  const users = data?.users || [];
  const mappings = data?.mappings || [];
  const userById = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  // owners a given viewer is mapped to
  const ownersOf = (viewerId) =>
    mappings.filter((m) => m.viewer_user_id === viewerId).map((m) => m.owner_user_id);
  const mappedCount = (viewerId) => ownersOf(viewerId).length;

  // Default selection: keep focusUserId, else first user once loaded.
  useEffect(() => {
    if (!selectedId && users.length) setSelectedId(focusUserId || users[0].id);
  }, [users, selectedId, focusUserId]);

  const selected = selectedId ? userById.get(selectedId) : null;
  const selectedOwners = selected ? ownersOf(selected.id) : [];
  const selectedOwnerSet = new Set(selectedOwners);

  const pickerList = users.filter((u) =>
    u.full_name.toLowerCase().includes(pickerSearch.trim().toLowerCase()),
  );

  // Candidates to add: everyone except self and already-mapped owners.
  const candidates = selected
    ? users.filter(
        (u) =>
          u.id !== selected.id &&
          !selectedOwnerSet.has(u.id) &&
          u.full_name.toLowerCase().includes(addSearch.trim().toLowerCase()),
      )
    : [];

  async function addOwner(ownerId) {
    setBusy(true);
    setError('');
    try {
      await api.adminAddMapping(selected.id, ownerId);
      await load();
      setAddSearch('');
    } catch (e) {
      setError(e.message || 'Could not add.');
    } finally {
      setBusy(false);
    }
  }
  async function removeOwner(ownerId) {
    const m = mappings.find((x) => x.viewer_user_id === selected.id && x.owner_user_id === ownerId);
    if (!m) return;
    setBusy(true);
    setError('');
    try {
      await api.adminDeleteMapping(m.id);
      await load();
    } catch (e) {
      setError(e.message || 'Could not remove.');
    } finally {
      setBusy(false);
    }
  }

  // Plain-language summary (§17.2): "{name} can view projects owned by: …".
  function summary() {
    if (!selected) return null;
    if (selectedOwners.length === 0)
      return `${selected.full_name} isn't mapped to anyone yet — they can only see their own projects.`;
    const names = selectedOwners.map((id) => userById.get(id)?.full_name).filter(Boolean);
    const shown = names.slice(0, 3).join(', ');
    const extra = names.length > 3 ? `, +${names.length - 3} more` : '';
    return `${selected.full_name} can view projects owned by: ${shown}${extra}.`;
  }

  const title = (
    <span className="breadcrumb">
      <button type="button" className="crumb-link" onClick={() => onNavigate({ name: 'list' })}>
        Projects
      </button>
      <span className="crumb-sep">›</span>
      <span className="crumb-current">Admin · Mappings</span>
    </span>
  );

  return (
    <AppShell title={title}>
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}
      <AdminTabs active="mappings" onNavigate={onNavigate} />

      {loadError && (
        <p className="auth-error" role="alert">
          {loadError}
        </p>
      )}

      {data === null ? (
        <p className="muted">Loading…</p>
      ) : (
        <>
          <div className="mappings-layout">
            {/* User picker */}
            <aside className="user-picker">
              <input
                type="search"
                className="filter-search"
                placeholder="Search users…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
              />
              <ul>
                {pickerList.map((u) => (
                  <li key={u.id}>
                    <button
                      type="button"
                      className={`picker-row ${u.id === selectedId ? 'active' : ''}`}
                      onClick={() => setSelectedId(u.id)}
                    >
                      <span className="owner-cell">
                        <Avatar name={u.full_name} />
                        {u.full_name}
                      </span>
                      <span className="picker-count">{mappedCount(u.id) || '—'}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Mapping panel */}
            <section className="mapping-panel">
              {selected ? (
                <>
                  <p className="mapping-summary">{summary()}</p>
                  {error && (
                    <p className="auth-error" role="alert">
                      {error}
                    </p>
                  )}

                  <h3 className="section-title">Mapped employees</h3>
                  {selectedOwners.length > 0 ? (
                    <ul className="mapped-list">
                      {selectedOwners.map((oid) => {
                        const o = userById.get(oid);
                        return (
                          <li key={oid} className="mapped-row">
                            <span className="owner-cell">
                              <Avatar name={o?.full_name} />
                              {o?.full_name}
                              <span className="muted"> · {o?.project_count ?? 0} projects</span>
                            </span>
                            <button
                              type="button"
                              className="file-remove"
                              disabled={busy}
                              title="Remove"
                              onClick={() => removeOwner(oid)}
                            >
                              ✕
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <p className="muted">No mapped employees.</p>
                  )}

                  <h3 className="section-title">+ Add employee</h3>
                  <input
                    type="search"
                    className="filter-search"
                    placeholder="Search to add…"
                    value={addSearch}
                    disabled={busy}
                    onChange={(e) => setAddSearch(e.target.value)}
                  />
                  <ul className="candidate-list">
                    {/* Self is shown disabled per §17.3. */}
                    <li>
                      <button type="button" className="candidate-row" disabled>
                        {selected.full_name} <span className="muted">— can't map to self</span>
                      </button>
                    </li>
                    {candidates.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          className="candidate-row"
                          disabled={busy}
                          onClick={() => addOwner(c.id)}
                        >
                          {c.full_name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="muted">Select a user to manage their mappings.</p>
              )}
            </section>
          </div>

          {/* Overview / audit table (§17.4) */}
          <h2 className="section-title overview-title">Mapping overview</h2>
          <table className="project-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Can view projects of</th>
                <th>{'# Employees'}</th>
              </tr>
            </thead>
            <tbody>
              {users
                .filter((u) => mappedCount(u.id) > 0)
                .map((u) => {
                  const names = ownersOf(u.id).map((id) => userById.get(id)?.full_name).filter(Boolean);
                  const shown = names.slice(0, 3).join(', ');
                  const extra = names.length > 3 ? `, +${names.length - 3} more` : '';
                  return (
                    <tr key={u.id}>
                      <td>
                        <span className="owner-cell">
                          <Avatar name={u.full_name} />
                          {u.full_name}
                        </span>
                      </td>
                      <td>
                        {shown}
                        {extra}
                      </td>
                      <td className="num">{names.length}</td>
                    </tr>
                  );
                })}
              {users.every((u) => mappedCount(u.id) === 0) && (
                <tr>
                  <td colSpan={3} className="muted">
                    No mappings yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </AppShell>
  );
}
