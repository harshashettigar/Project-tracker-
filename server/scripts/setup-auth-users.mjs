// One-off Phase 0 setup: create the four demo auth identities AND their
// matching public.users rows, so the sample-data seed (supabase/seed.sql)
// resolves owners by email and its foreign keys line up automatically.
//
// Uses the SERVICE_ROLE key (admin API + RLS bypass). Run once after
// `supabase db push`:
//
//   cd server && npm install && npm run setup:auth
//
// Idempotent: re-running reuses existing auth users and upserts public.users.
// Demo passwords are set here for dog-fooding; rotate / reset for real use.

import '../src/env.js'; // mode-aware env load (+ banner). Pass --prod to target prod.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see .env).');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

// Default demo password for all four accounts (override per-user if desired).
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD || 'DemoPass!234';

const DEMO_USERS = [
  { email: 'appuser1.msc@manipalsplchem.com', full_name: 'Demo Admin',   role: 'admin' },
  { email: 'manager.demo@manipalsplchem.com', full_name: 'Demo Manager', role: 'manager' },
  { email: 'member.demo@manipalsplchem.com',  full_name: 'Demo Member',  role: 'member' },
  { email: 'viewer.demo@manipalsplchem.com',  full_name: 'Demo Viewer',  role: 'viewer' },
];

// Find an existing auth user by email (paginates the admin list).
async function findAuthUserByEmail(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match;
    if (data.users.length < 200) break; // last page
  }
  return null;
}

async function ensureAuthUser({ email, full_name }) {
  const existing = await findAuthUserByEmail(email);
  if (existing) {
    console.log(`  auth: reused  ${email}  (${existing.id})`);
    return existing.id;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: DEMO_PASSWORD,
    email_confirm: true, // skip the confirmation email for demo accounts
    user_metadata: { full_name },
  });
  if (error) throw error;
  console.log(`  auth: created ${email}  (${data.user.id})`);
  return data.user.id;
}

async function main() {
  console.log(`Setting up ${DEMO_USERS.length} demo users on ${url}`);
  for (const u of DEMO_USERS) {
    const id = await ensureAuthUser(u);
    const { error } = await admin
      .from('users')
      .upsert(
        { id, email: u.email, full_name: u.full_name, role: u.role, status: 'active', invited_at: new Date().toISOString() },
        { onConflict: 'id' }
      );
    if (error) throw error;
    console.log(`  users: upserted ${u.email} as ${u.role}`);
  }
  console.log('\nDone. Demo password for all accounts:', DEMO_PASSWORD);
  console.log('Next: load sample data →  psql "$DATABASE_URL" -f ../supabase/seed.sql');
}

main().catch((err) => {
  console.error('\nSetup failed:', err.message || err);
  process.exit(1);
});
