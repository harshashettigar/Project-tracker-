// Supabase clients for the API layer.
//
// IMPORTANT (PRD §3): the API is a security boundary but RLS in the database is
// the *final* one. For per-request work the API should act AS THE USER (forward
// their access token) so RLS applies. The service-role client bypasses RLS and
// must only be used for trusted admin/server tasks (e.g. seeding, audit writes).

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_ANON_KEY (see .env.example).');
}

// Service-role client — bypasses RLS. Use sparingly and never expose to clients.
export const serviceClient = serviceRoleKey
  ? createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  : null;

// Build a request-scoped client that carries the caller's JWT so RLS applies.
export function clientForToken(accessToken) {
  return createClient(url, anonKey, {
    auth: { persistSession: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}
