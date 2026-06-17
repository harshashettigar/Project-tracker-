// Create-project modal (PRD §9.4). Deliberately light: name (required),
// objective (optional), owner (defaults to the current user), start date
// (defaults to today). No target date — it is derived later (§12.2). On save the
// project is created as a Draft.
//
// PRD §9.4 also says the new project "opens immediately in Edit mode." The detail
// screen arrives in Phase 3/4, so for now we create + confirm + refresh the list,
// and open-in-Edit is wired when detail exists (noted in decisions.md).

import { useState } from 'react';

function today() {
  // Local YYYY-MM-DD for the date input's default.
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function NewProjectModal({ profile, users, onClose, onCreated }) {
  const isAdmin = profile?.role === 'admin';

  const [name, setName] = useState('');
  const [objective, setObjective] = useState('');
  const [ownerId, setOwnerId] = useState(profile?.id || '');
  const [startDate, setStartDate] = useState(today());
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!name.trim()) {
      setError('Project name is required.'); // PRD §19.1, verbatim
      return;
    }
    setBusy(true);
    try {
      const project = await onCreated({
        name: name.trim(),
        objective: objective.trim() || undefined,
        owner_user_id: isAdmin ? ownerId : undefined,
        start_date: startDate,
      });
      if (project) onClose();
    } catch (err) {
      setError(err.message || 'Could not create the project.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="New project"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={handleSubmit} noValidate>
          <h2 className="modal-title">New project</h2>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">Project name</span>
            <input
              type="text"
              value={name}
              disabled={busy}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Objective (optional)</span>
            <textarea
              rows={3}
              value={objective}
              disabled={busy}
              onChange={(e) => setObjective(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Owner / Responsible</span>
            {isAdmin ? (
              <select value={ownerId} disabled={busy} onChange={(e) => setOwnerId(e.target.value)}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                    {u.id === profile.id ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            ) : (
              // Non-admins can only own their own projects (PRD §18 / RLS).
              <input type="text" value={profile?.full_name || ''} disabled readOnly />
            )}
          </label>

          <label className="field">
            <span className="field-label">Start date</span>
            <input
              type="date"
              value={startDate}
              disabled={busy}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Creating…' : 'Create project'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
