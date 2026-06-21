// Authentication & login (PRD §8). Internal, invite-only — there is no sign-up.
// All inline messages and the toast use the exact wording from PRD §8.3.
// Layout follows the reference mockup (docs/design/.../Project Tracker.dc.html):
// a navy gradient header band with the MSC logo + brand, then the sign-in form.

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
  const [logoFailed, setLogoFailed] = useState(false);

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

      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo-chip">
            {logoFailed ? (
              <span className="auth-logo-fallback" aria-hidden="true">
                PT
              </span>
            ) : (
              <img
                src="/logo.png"
                alt="Manipal Specialty Chemicals"
                onError={() => setLogoFailed(true)}
              />
            )}
          </div>
          <div className="auth-header-text">
            <div className="auth-brand">Project Tracker</div>
            <div className="auth-org">Manipal Specialty Chemicals</div>
          </div>
        </div>

        <form className="auth-body" onSubmit={handleSubmit} noValidate>
          <h1 className="auth-heading">Sign in</h1>
          <p className="auth-subtext">Use your work email to access the tracker.</p>

          {error && (
            <div className="auth-error" role="alert">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v5M12 16h.01" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <label className="field">
            <span className="field-label">Email</span>
            <input
              type="email"
              autoComplete="username"
              placeholder="you@manipalsplchem.com"
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
                placeholder="Enter your password"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button
                type="button"
                className="pw-toggle"
                title="Show or hide password"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                onClick={() => setShowPassword((v) => !v)}
                disabled={busy}
              >
                {showPassword ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                    <path d="M1 1l22 22" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                )}
              </button>
            </div>
          </label>

          <div className="auth-forgot-row">
            <button
              type="button"
              className="link-button forgot"
              onClick={handleForgot}
              disabled={busy}
            >
              Forgot password?
            </button>
          </div>

          <button type="submit" className="primary-button full" disabled={busy}>
            {busy && <span className="btn-spinner" aria-hidden="true" />}
            {busy ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="auth-footer">Internal &amp; invite-only access.</p>
        </form>
      </div>
    </div>
  );
}
