// Authenticated app shell (PRD §7.1). The persistent navy top bar that wraps
// every authenticated screen: app title on the left, account menu on the right.
// The View/Edit toggle (detail screens) and New project button (list) slot in
// here in later phases; for now the body is a placeholder for the project list.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';

function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppShell() {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const isAdmin = profile?.role === 'admin';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-title">
          <span className="topbar-mark" aria-hidden="true">
            PT
          </span>
          <span>Project Tracker</span>
        </div>

        <div className="account" ref={menuRef}>
          <button
            type="button"
            className="avatar"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title={profile?.full_name || profile?.email}
            onClick={() => setMenuOpen((v) => !v)}
          >
            {initials(profile?.full_name)}
          </button>

          {menuOpen && (
            <div className="account-menu" role="menu">
              <div className="account-id">
                <div className="account-name">{profile?.full_name}</div>
                <div className="account-email">{profile?.email}</div>
              </div>
              {isAdmin && (
                <button type="button" role="menuitem" className="menu-item" disabled>
                  Admin
                </button>
              )}
              <button type="button" role="menuitem" className="menu-item" onClick={signOut}>
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="shell-body">
        <h1>Projects</h1>
        <p className="muted">
          Signed in as {profile?.full_name} ({profile?.role}). The project list
          arrives in Phase 2.
        </p>
      </main>
    </div>
  );
}
