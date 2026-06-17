// Editable milestone block (PRD §11.2): rename, set target (required, §12.1), set
// status, reorder, remove; plus its task editors and a context-aware "+ Add task"
// (target optional under a milestone). Reorder of milestones/tasks is handled by
// the parent (it owns the sibling order) and passed in as onMove/onMoveTask.

import { useState } from 'react';
import { api } from '../../lib/api.js';
import { STATUSES } from '../../lib/format.js';
import TaskEditor from './TaskEditor.jsx';
import AddTaskForm from './AddTaskForm.jsx';

export default function MilestoneEditor({ projectId, milestone, index, count, onMove, onMoveTask, reload }) {
  const [name, setName] = useState(milestone.name);
  const [targetDate, setTargetDate] = useState(milestone.target_date || '');
  const [status, setStatus] = useState(milestone.status);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const dirty =
    name !== milestone.name ||
    (targetDate || '') !== (milestone.target_date || '') ||
    status !== milestone.status;

  async function save() {
    if (!name.trim()) return setError('Milestone name is required.');
    if (!targetDate) return setError('Milestone target date is required.');
    setBusy(true);
    setError('');
    try {
      await api.updateMilestone(milestone.id, { name: name.trim(), target_date: targetDate, status });
      await reload();
    } catch (e) {
      setError(e.message || 'Could not save.');
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Remove milestone "${milestone.name}" and its tasks?`)) return;
    setBusy(true);
    try {
      await api.deleteMilestone(milestone.id);
      await reload();
    } catch (e) {
      setError(e.message || 'Could not remove.');
      setBusy(false);
    }
  }

  return (
    <section className="milestone-block">
      <header className="milestone-header editing">
        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}
        <div className="edit-grid">
          <label className="field">
            <span className="field-label">Milestone name</span>
            <input value={name} disabled={busy} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Target *</span>
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
        </div>
        <div className="edit-row-actions">
          <button type="button" className="reorder" disabled={busy || index === 0} onClick={() => onMove(-1)} title="Move up">
            ▲
          </button>
          <button type="button" className="reorder" disabled={busy || index === count - 1} onClick={() => onMove(1)} title="Move down">
            ▼
          </button>
          {dirty && (
            <button type="button" className="primary-button small" disabled={busy} onClick={save}>
              Save
            </button>
          )}
          <button type="button" className="danger-button small" disabled={busy} onClick={remove}>
            Remove
          </button>
        </div>
      </header>

      <div className="milestone-tasks">
        {milestone.tasks.map((t, i) => (
          <TaskEditor
            key={t.id}
            task={t}
            targetRequired={false}
            index={i}
            count={milestone.tasks.length}
            onMove={(dir) => onMoveTask(milestone.tasks, i, dir)}
            reload={reload}
          />
        ))}
        <AddTaskForm
          targetRequired={false}
          onAdd={(payload) => api.addTask(projectId, { ...payload, milestone_id: milestone.id }).then(reload)}
        />
      </div>
    </section>
  );
}
