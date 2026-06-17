// Set-password screen, shared by the invite-to-set-password and the
// forgot-password reset flows (PRD §8.2). Both land here with a recovery
// session already established by Supabase; the user chooses a new password.

import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

const MIN_LENGTH = 8;

export default function SetPassword() {
  const { updatePassword } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    const result = await updatePassword(password);
    setBusy(false);

    // On success the recovery flag clears and AuthProvider routes onward.
    if (!result.ok) setError('Could not set your password. Try the link again.');
  }

  return (
    <div className="auth-bg">
      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-mark" aria-hidden="true">
          PT
        </div>
        <h1 className="auth-heading">Set your password</h1>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="field-label">New password</span>
          <div className="field-with-toggle">
            <input
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="link-button"
              onClick={() => setShow((v) => !v)}
              disabled={busy}
            >
              {show ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <label className="field">
          <span className="field-label">Confirm password</span>
          <input
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={confirm}
            disabled={busy}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </label>

        <button type="submit" className="primary-button full" disabled={busy}>
          {busy ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  );
}
