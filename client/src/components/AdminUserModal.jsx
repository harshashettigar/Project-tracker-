// Add / edit user modal (PRD §16.3). Lightweight: Full name, Email, Role, Status.
// On add, the user is invited by email to set their own password — the admin
// never types one. Email is the identity, so it is read-only when editing.
// Validation wording is verbatim from §16.3/§19.1.

import { useState } from 'react';

const ROLES = [
  { value: 'admin', label: 'Admin' },
  { value: 'manager', label: 'Manager' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AdminUserModal({ user, onClose, onSubmit }) {
  const editing = !!user;
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [role, setRole] = useState(user?.role || 'member');
  const [status, setStatus] = useState(user?.status || 'active');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!fullName.trim()) return setError('Full name is required.');
    if (!editing && !EMAIL_RE.test(email.trim()))
      return setError('Enter a valid email address.');

    setBusy(true);
    try {
      const payload = editing
        ? { full_name: fullName.trim(), role, status }
        : { full_name: fullName.trim(), email: email.trim(), role, status };
      await onSubmit(payload);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not save.');
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={editing ? 'Edit user' : 'Add user'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} noValidate>
          <h2 className="modal-title">{editing ? 'Edit user' : 'Add user'}</h2>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">Full name</span>
            <input value={fullName} disabled={busy} autoFocus onChange={(e) => setFullName(e.target.value)} />
          </label>

          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              value={email}
              disabled={busy || editing}
              readOnly={editing}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>

          <label className="field">
            <span className="field-label">Role</span>
            <select value={role} disabled={busy} onChange={(e) => setRole(e.target.value)}>
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span className="field-label">Status</span>
            <select value={status} disabled={busy} onChange={(e) => setStatus(e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>

          {!editing && (
            <p className="muted invite-note">
              The user is created with the default password <strong>Manipal@123</strong>. Share it
              with them — they can change it from the account menu after signing in.
            </p>
          )}

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create user'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
