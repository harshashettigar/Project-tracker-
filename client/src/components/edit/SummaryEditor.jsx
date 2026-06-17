// Editable summary band + objective (PRD §11.2). Name, start, status and owner
// are editable; the target date stays derived and read-only (§12.2), so it is
// not shown here. Owner can be reassigned only by an admin (RLS enforces it too).

import { useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { STATUSES } from '../../lib/format.js';

export default function SummaryEditor({ project, users, reload }) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const [name, setName] = useState(project.name);
  const [startDate, setStartDate] = useState(project.start_date || '');
  const [status, setStatus] = useState(project.status);
  const [ownerId, setOwnerId] = useState(project.owner_user_id);
  const [objective, setObjective] = useState(project.objective || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== project.name ||
    (startDate || '') !== (project.start_date || '') ||
    status !== project.status ||
    ownerId !== project.owner_user_id ||
    (objective || '') !== (project.objective || '');

  async function save() {
    if (!name.trim()) return setError('Project name is required.');
    setBusy(true);
    setError('');
    const patch = {
      name: name.trim(),
      start_date: startDate || null,
      status,
      objective: objective.trim() || null,
    };
    if (isAdmin && ownerId !== project.owner_user_id) patch.owner_user_id = ownerId;
    try {
      await api.updateProject(project.id, patch);
      await reload();
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="summary-band editing">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="edit-grid">
        <label className="field">
          <span className="field-label">Project name</span>
          <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Start date</span>
          <input type="date" value={startDate} disabled={busy} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Status</span>
          <select value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">Owner / Responsible</span>
          {isAdmin ? (
            <select value={ownerId} disabled={busy} onChange={(e) => setOwnerId(e.target.value)}>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.full_name}
                </option>
              ))}
            </select>
          ) : (
            <input value={project.owner_name || ''} disabled readOnly />
          )}
        </label>
      </div>

      <label className="field objective-field">
        <span className="field-label">Objective</span>
        <textarea rows={3} value={objective} disabled={busy} onChange={(e) => setObjective(e.target.value)} />
      </label>

      <div className="summary-edit-actions">
        <span className="muted derived-note">Target date is derived (AUTO) and not editable.</span>
        <button type="button" className="primary-button" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </section>
  );
}
