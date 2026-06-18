// Single source of truth for the client's auth state (PRD §8, §20.1).
//
// What lives here:
//  - the Supabase session (or null),
//  - the app profile from GET /api/me (the *real* gate — an authenticated token
//    is not enough; the users row must exist and be active, enforced server-side),
//  - a "recovery" flag for the invite / reset set-password flow,
//  - the auth actions the screens call.
//
// The front end is never the security boundary (PRD §3): this context decides
// what to *show*, but the API and RLS decide what a user may actually do.

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase.js';
import { API_BASE } from '../lib/api.js';

const AuthContext = createContext(null);

// Supabase invite / reset links land back on the app with a hash that names the
// flow. We also listen for the PASSWORD_RECOVERY event below; either is enough.
function hashFlow() {
  const hash = window.location.hash || '';
  if (hash.includes('type=recovery')) return 'recovery';
  if (hash.includes('type=invite')) return 'invite';
  return null;
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true); // resolving the initial session
  const [recovery, setRecovery] = useState(hashFlow() !== null);

  // Confirm the signed-in user has an active app profile. Returns the profile,
  // or throws an Error whose message is one of: 'inactive' | 'no profile' | …
  const loadProfile = useCallback(async (accessToken) => {
    const res = await fetch(`${API_BASE}/api/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'profile load failed');
    setProfile(body.user);
    return body.user;
  }, []);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      if (!active) return;
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      setSession(next ?? null);
      if (!next) setProfile(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Whenever we hold a session (and aren't mid set-password), make sure the app
  // profile is loaded and active. An inactive account is signed straight back
  // out — the refusal is the server's (PRD §8.3), we just react to it.
  useEffect(() => {
    if (recovery) return;
    if (!session) return;
    if (profile) return;
    let active = true;
    loadProfile(session.access_token).catch(async () => {
      if (!active) return;
      await supabase.auth.signOut();
    });
    return () => {
      active = false;
    };
  }, [session, profile, recovery, loadProfile]);

  // --- actions the screens call ------------------------------------------

  // Returns { ok: true } or { ok: false, error: '<code>' } so Login can map the
  // code to the exact PRD §8.3 wording. Never throws for expected failures.
  const signIn = useCallback(
    async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { ok: false, error: 'bad-credentials' };
      try {
        await loadProfile(data.session.access_token);
      } catch (e) {
        await supabase.auth.signOut();
        return { ok: false, error: e.message === 'inactive' ? 'inactive' : 'no-access' };
      }
      return { ok: true };
    },
    [loadProfile],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const sendReset = useCallback(async (email) => {
    // Redirect target carries the recovery hash back to the app.
    await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/#type=recovery`,
    });
    // Per PRD §8.3 we always confirm, regardless of whether the email exists.
    return { ok: true };
  }, []);

  const updatePassword = useCallback(
    async (password) => {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) return { ok: false, error: error.message };
      setRecovery(false);
      // Clear the recovery hash so a refresh doesn't reopen the flow.
      window.history.replaceState(null, '', window.location.pathname);
      return { ok: true };
    },
    [],
  );

  const value = {
    session,
    profile,
    loading,
    recovery,
    signIn,
    signOut,
    sendReset,
    updatePassword,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
