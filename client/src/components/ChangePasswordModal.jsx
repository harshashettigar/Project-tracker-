// Self-service change password (account menu). Verifies the current password,
// then sets a new one. No email needed — the logged-in user updates their own
// credential via Supabase. Min length mirrors the set-password screen.

import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

const MIN_LEN = 8;

export default function ChangePasswordModal({ onClose, onDone }) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError('');
    if (!current) return setError('Enter your current password.');
    if (next.length < MIN_LEN) return setError(`New password must be at least ${MIN_LEN} characters.`);
    if (next !== confirm) return setError('The new passwords do not match.');
    if (next === current) return setError('The new password must be different from the current one.');

    setBusy(true);
    const res = await changePassword(current, next);
    setBusy(false);
    if (!res.ok) {
      setError(res.error === 'bad-current' ? 'Your current password is incorrect.' : res.error || 'Could not change password.');
      return;
    }
    onDone?.();
    onClose();
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Change password"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <form onSubmit={submit} noValidate>
          <h2 className="modal-title">Change password</h2>

          {error && (
            <p className="auth-error" role="alert">
              {error}
            </p>
          )}

          <label className="field">
            <span className="field-label">Current password</span>
            <input type="password" value={current} disabled={busy} autoFocus onChange={(e) => setCurrent(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">New password</span>
            <input type="password" value={next} disabled={busy} onChange={(e) => setNext(e.target.value)} />
          </label>
          <label className="field">
            <span className="field-label">Confirm new password</span>
            <input type="password" value={confirm} disabled={busy} onChange={(e) => setConfirm(e.target.value)} />
          </label>

          <div className="modal-actions">
            <button type="button" className="ghost-button" onClick={onClose} disabled={busy}>
              Cancel
            </button>
            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? 'Saving…' : 'Change password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
