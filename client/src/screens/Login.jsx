// Authentication & login (PRD §8). Internal, invite-only — there is no sign-up.
// All inline messages and the toast use the exact wording from PRD §8.3.

import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

// PRD §8.3 — verbatim strings. Keep these exact.
const MSG = {
  empty: 'Enter your email and password to continue.',
  badCredentials: 'Incorrect email or password. Please try again.',
  inactive: 'Your account is inactive — contact an administrator.',
  resetToast: 'Password reset link sent — check your email.',
};

export default function Login() {
  const { signIn, sendReset } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    // Empty email or password → inline message, no request made (PRD §8.3).
    if (!email.trim() || !password) {
      setError(MSG.empty);
      return;
    }

    setBusy(true);
    const result = await signIn(email.trim(), password);
    setBusy(false);

    if (result.ok) return; // AuthProvider swaps the screen to the app shell.

    if (result.error === 'inactive') setError(MSG.inactive);
    else setError(MSG.badCredentials); // bad-credentials and no-access alike
  }

  async function handleForgot() {
    setError('');
    if (!email.trim()) {
      setError(MSG.empty);
      return;
    }
    await sendReset(email.trim());
    setToast(MSG.resetToast);
  }

  return (
    <div className="auth-bg">
      {toast && (
        <div className="toast" role="status" onAnimationEnd={() => setToast('')}>
          {toast}
        </div>
      )}

      <form className="auth-card" onSubmit={handleSubmit} noValidate>
        <div className="auth-mark" aria-hidden="true">
          PT
        </div>
        <h1 className="auth-heading">Sign in</h1>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        <label className="field">
          <span className="field-label">Email</span>
          <input
            type="email"
            autoComplete="username"
            value={email}
            disabled={busy}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <label className="field">
          <span className="field-label">Password</span>
          <div className="field-with-toggle">
            <input
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={password}
              disabled={busy}
              onChange={(e) => setPassword(e.target.value)}
            />
            <button
              type="button"
              className="link-button"
              onClick={() => setShowPassword((v) => !v)}
              disabled={busy}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
        </label>

        <button type="submit" className="primary-button full" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        <button
          type="button"
          className="link-button forgot"
          onClick={handleForgot}
          disabled={busy}
        >
          Forgot password?
        </button>

        <p className="auth-footer">Access is internal and invite-only.</p>
      </form>
    </div>
  );
}
