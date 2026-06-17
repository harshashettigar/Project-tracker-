// Top-level routing for Phase 1 (Auth & shell). No URL router yet — the three
// states are decided entirely by auth status (PRD §6 navigation rules):
//   recovery (invite / reset) → SetPassword
//   no session                → Login
//   session + active profile  → AppShell
//
// Route guarding here is a UX convenience only; the API and RLS are the real
// boundary (PRD §3).

import { useAuth } from './auth/AuthProvider.jsx';
import Login from './screens/Login.jsx';
import SetPassword from './screens/SetPassword.jsx';
import AuthedApp from './screens/AuthedApp.jsx';

export default function App() {
  const { session, profile, loading, recovery } = useAuth();

  if (loading) {
    return (
      <div className="auth-bg">
        <div className="auth-card">
          <p className="muted">Loading…</p>
        </div>
      </div>
    );
  }

  if (recovery) return <SetPassword />;
  if (!session) return <Login />;

  // Session present but profile not yet confirmed active. AuthProvider is either
  // loading it or signing an inactive/unknown account back out (→ Login).
  if (!profile) {
    return (
      <div className="auth-bg">
        <div className="auth-card">
          <p className="muted">Signing in…</p>
        </div>
      </div>
    );
  }

  return <AuthedApp />;
}
