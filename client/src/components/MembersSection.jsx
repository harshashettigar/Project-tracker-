// Project members (members extension). Beyond the single owner ("Responsible"),
// a project may have members who can view AND fully edit it. View mode shows the
// member list read-only; Edit mode lets an editor (owner/admin/member) add a
// member from the user directory or remove one. Capability is enforced server/
// DB-side (can_edit_project); this UI only renders the controls.

import { useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import Avatar from './Avatar.jsx';

export default function MembersSection({ projectId, ownerUserId, members, users, editing, reload }) {
  const [pick, setPick] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const memberIds = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);

  // Candidates to add: active users who aren't the owner and aren't already members.
  const candidates = useMemo(
    () => users.filter((u) => u.id !== ownerUserId && !memberIds.has(u.id) && u.status !== 'inactive'),
    [users, ownerUserId, memberIds],
  );

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  function add() {
    if (!pick) return;
    run(async () => {
      await api.addMember(projectId, pick);
      setPick('');
    });
  }

  function remove(m) {
    if (!window.confirm(`Remove ${m.name || 'this member'} from the project?`)) return;
    run(() => api.removeMember(projectId, m.user_id));
  }

  // View mode with no members: stay calm and render nothing.
  if (!editing && members.length === 0) return null;

  return (
    <section className="strip detail-card members-card">
      <h2 className="section-title">Members</h2>
      <p className="muted members-hint">Members can view and edit this project, in addition to the owner.</p>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {members.length > 0 ? (
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.user_id} className="member-row">
              <span className="member-id">
                <Avatar name={m.name} />
                <span className="member-name">{m.name ?? '—'}</span>
              </span>
              {editing && (
                <button
                  type="button"
                  className="file-remove"
                  title="Remove member"
                  disabled={busy}
                  onClick={() => remove(m)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        editing && <p className="muted">No members yet.</p>
      )}

      {editing && (
        <div className="member-add">
          <select value={pick} disabled={busy || candidates.length === 0} onChange={(e) => setPick(e.target.value)}>
            <option value="">{candidates.length ? 'Add a member…' : 'No more users to add'}</option>
            {candidates.map((u) => (
              <option key={u.id} value={u.id}>
                {u.full_name}
              </option>
            ))}
          </select>
          <button type="button" className="primary-button small" disabled={busy || !pick} onClick={add}>
            + Add member
          </button>
        </div>
      )}
    </section>
  );
}
