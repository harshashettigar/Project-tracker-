// "+ Add task" form (PRD §11.3). Required fields change by context (§12.1):
// `targetRequired` is true for a project-level task (no milestone), false for a
// task under a milestone — shown in place (marker + inline validation), not only
// on save.

import { useState } from 'react';
import { STATUSES, PRIORITIES } from '../../lib/format.js';

export default function AddTaskForm({ targetRequired, onAdd }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [status, setStatus] = useState('draft');
  const [priority, setPriority] = useState('mid');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function reset() {
    setName('');
    setStartDate('');
    setTargetDate('');
    setStatus('draft');
    setPriority('mid');
    setError('');
  }

  async function add() {
    if (!name.trim()) return setError('Task name is required.');
    if (targetRequired && !targetDate)
      return setError('Target date is required for project-level tasks.');
    setBusy(true);
    setError('');
    try {
      await onAdd({
        name: name.trim(),
        start_date: startDate || null,
        target_date: targetDate || null,
        status,
        priority,
      });
      reset();
      setOpen(false);
    } catch (e) {
      setError(e.message || 'Could not add the task.');
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button type="button" className="add-affordance" onClick={() => setOpen(true)}>
        + Add task
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
          <span className="field-label">Task name</span>
          <input value={name} disabled={busy} autoFocus onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Start</span>
          <input type="date" value={startDate} disabled={busy} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">
            Target{targetRequired ? ' *' : ' (optional)'}
          </span>
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
        <label className="field">
          <span className="field-label">Priority</span>
          <select value={priority} disabled={busy} onChange={(e) => setPriority(e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="composer-actions">
        <button type="button" className="ghost-button" disabled={busy} onClick={() => { reset(); setOpen(false); }}>
          Cancel
        </button>
        <button type="button" className="primary-button" disabled={busy} onClick={add}>
          {busy ? 'Adding…' : 'Add task'}
        </button>
      </div>
    </div>
  );
}
