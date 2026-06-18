// Authenticated app shell / layout (PRD §7.1). The persistent navy top bar that
// wraps every authenticated screen: app title on the left, an optional actions
// slot (e.g. the New project button on the list — §7.1), then the account menu.
// Screens render their content as children.

import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import { initials } from '../lib/format.js';

// `title` overrides the default product title (e.g. the project-name breadcrumb
// on detail screens, §7.1); omit it on the list/admin screens. `onAdmin`, when
// provided to an admin, makes the account-menu "Admin" item navigate (§16.1).
export default function AppShell({
  actions = null,
  title = null,
  onAdmin = null,
  onHome = null,
  children,
}) {
  const { profile, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  // The logo asset is dropped in at client/public/logo.png. Until it exists the
  // <img> 404s; we fall back to the "PT" text mark so the bar never looks broken.
  const [logoFailed, setLogoFailed] = useState(false);
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
          {(() => {
            const brand = (
              <>
                {logoFailed ? (
                  <span className="topbar-mark" aria-hidden="true">
                    PT
                  </span>
                ) : (
                  <img
                    className="topbar-logo"
                    src="/logo.png"
                    alt=""
                    onError={() => setLogoFailed(true)}
                  />
                )}
                <span className="topbar-brand-name">Project Tracker</span>
              </>
            );
            return onHome ? (
              <button type="button" className="topbar-brand" onClick={onHome}>
                {brand}
              </button>
            ) : (
              <span className="topbar-brand">{brand}</span>
            );
          })()}
          {title && (
            <>
              <span className="topbar-sep" aria-hidden="true">
                /
              </span>
              <span className="topbar-page">{title}</span>
            </>
          )}
        </div>

        <div className="topbar-right">
          {actions}

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
                  <button
                    type="button"
                    role="menuitem"
                    className="menu-item"
                    disabled={!onAdmin}
                    onClick={() => {
                      setMenuOpen(false);
                      onAdmin?.();
                    }}
                  >
                    Admin
                  </button>
                )}
                <button type="button" role="menuitem" className="menu-item" onClick={signOut}>
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="shell-body">{children}</main>
    </div>
  );
}
