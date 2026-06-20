// Editable task row (PRD §11.2). Edit name/start/target/status; reorder; remove;
// post an update. `targetRequired` reflects §12.1 — true for project-level tasks
// (no milestone), false under a milestone — and drives the required marker +
// inline validation in place rather than only on save.

import { useState } from 'react';
import { api } from '../../lib/api.js';
import { STATUSES, PRIORITIES } from '../../lib/format.js';
import TaskUpdateThread from '../TaskUpdateThread.jsx';
import UpdateComposer from './UpdateComposer.jsx';

export default function TaskEditor({ task, targetRequired, index, count, onMove, reload }) {
  const [name, setName] = useState(task.name);
  const [startDate, setStartDate] = useState(task.start_date || '');
  const [targetDate, setTargetDate] = useState(task.target_date || '');
  const [status, setStatus] = useState(task.status);
  const [priority, setPriority] = useState(task.priority || 'mid');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [composing, setComposing] = useState(false);
  const [editingLatest, setEditingLatest] = useState(false);

  const latest = task.updates[0];

  const dirty =
    name !== task.name ||
    (startDate || '') !== (task.start_date || '') ||
    (targetDate || '') !== (task.target_date || '') ||
    status !== task.status ||
    priority !== (task.priority || 'mid');

  async function save() {
    if (!name.trim()) return setError('Task name is required.');
    if (targetRequired && !targetDate)
      return setError('Target date is required for project-level tasks.');
    setBusy(true);
    setError('');
    try {
      await api.updateTask(task.id, {
        name: name.trim(),
        start_date: startDate || null,
        target_date: targetDate || null,
        status,
        priority,
      });
      await reload();
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove task "${task.name}"?`)) return;
    setBusy(true);
    try {
      await api.deleteTask(task.id);
      await reload();
    } catch (e) {
      setError(e.message || 'Could not remove.');
    } finally {
      setBusy(false);
    }
  }

  async function postUpdate(body) {
    await api.postUpdate(task.id, body);
    await reload();
    setComposing(false);
  }

  // Correct the latest update in place (§13, amended). Server + RLS allow this
  // for the newest update only; prior history stays untouched.
  async function editLatest(body) {
    await api.editUpdate(latest.id, body);
    await reload();
    setEditingLatest(false);
  }

  return (
    <div className="task-editor">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <div className="edit-grid">
        <label className="field">
          <span className="field-label">Task name</span>
          <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">Start</span>
          <input
            type="date"
            value={startDate}
            disabled={busy}
            onChange={(e) => setStartDate(e.target.value)}
          />
        </label>
        <label className="field">
          <span className="field-label">Target{targetRequired ? ' *' : ''}</span>
          <input
            type="date"
            value={targetDate}
            disabled={busy}
            onChange={(e) => setTargetDate(e.target.value)}
          />
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

      <div className="edit-row-actions">
        <button type="button" className="reorder" disabled={busy || index === 0} onClick={() => onMove(-1)} title="Move up">
          ▲
        </button>
        <button
          type="button"
          className="reorder"
          disabled={busy || index === count - 1}
          onClick={() => onMove(1)}
          title="Move down"
        >
          ▼
        </button>
        {dirty && (
          <button type="button" className="primary-button small" disabled={busy} onClick={save}>
            Save
          </button>
        )}
        <button
          type="button"
          className="ghost-button small"
          disabled={busy}
          onClick={() => {
            setEditingLatest(false);
            setComposing((v) => !v);
          }}
        >
          {composing ? 'Close' : 'Add update'}
        </button>
        {latest && (
          <button
            type="button"
            className="ghost-button small"
            disabled={busy}
            onClick={() => {
              setComposing(false);
              setEditingLatest((v) => !v);
            }}
          >
            {editingLatest ? 'Close' : 'Edit latest update'}
          </button>
        )}
        <button type="button" className="danger-button small" disabled={busy} onClick={remove}>
          Remove
        </button>
      </div>

      {composing && (
        <UpdateComposer
          latestBody={latest?.body || ''}
          onPost={postUpdate}
          onCancel={() => setComposing(false)}
        />
      )}

      {editingLatest && latest && (
        <UpdateComposer
          latestBody={latest.body}
          onPost={editLatest}
          onCancel={() => setEditingLatest(false)}
          submitLabel="Save update"
          busyLabel="Saving…"
        />
      )}

      <TaskUpdateThread updates={task.updates} />
    </div>
  );
}
