// "+ Add milestone" form (PRD §11.3). Name and target date are both required
// (§12.1/§19.1); status defaults to Draft.

import { useState } from 'react';
import { api } from '../../lib/api.js';
import { STATUSES } from '../../lib/format.js';

export default function AddMilestoneForm({ projectId, reload }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setDescription('');
    setTargetDate('');
    setStatus('draft');
    setError('');
  }

  async function add() {
    if (!name.trim()) return setError('Milestone name is required.');
    if (!targetDate) return setError('Milestone target date is required.');
    setBusy(true);
    setError('');
    try {
      await api.addMilestone(projectId, {
        name: name.trim(),
        description: description.trim() || null,
        target_date: targetDate,
        status,
      });
      await reload();
      reset();
      setOpen(false);
    } catch (e) {
      setError(e.message || 'Could not add the milestone.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="add-affordance milestone-add" onClick={() => setOpen(true)}>
        + Add milestone
      </button>
    );
  }

  return (
    <div className="add-form">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="edit-grid">
        <label className="field">
          <span className="field-label">Milestone name</span>
          <input value={name} disabled={busy} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Target *</span>
          <input type="date" value={targetDate} disabled={busy} onChange={(e) => setTargetDate(e.target.value)} />
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
        <label className="field field-full">
          <span className="field-label">Description (optional)</span>
          <textarea
            className="field-textarea"
            rows={2}
            maxLength={2000}
            value={description}
            disabled={busy}
            placeholder="Extra context, shown behind an info icon next to the name."
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
      </div>
      <div className="composer-actions">
        <button type="button" className="ghost-button" disabled={busy} onClick={() => { reset(); setOpen(false); }}>
          Cancel
        </button>
        <button type="button" className="primary-button" disabled={busy} onClick={add}>
          {busy ? 'Adding…' : 'Add milestone'}
        </button>
      </div>
    </div>
  );
}
