// One-off: set EVERY existing user's password to the shared default
// (DEFAULT_USER_PASSWORD / Manipal@123). Used during the no-SMTP phase so the
// existing user base has a known password they can sign in with and then change
// from the account menu. Uses the SERVICE_ROLE key (admin auth API).
//
//   cd server && node scripts/reset-all-passwords.mjs
//
// Idempotent and safe to re-run. NOTE: this also resets the admin's own password.

import '../src/env.js'; // mode-aware env load (+ banner). Pass --prod to target prod.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see .env).');
  process.exit(1);
}

const DEFAULT_PASSWORD = process.env.DEFAULT_USER_PASSWORD || 'Manipal@123';
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

async function main() {
  const { data: users, error } = await admin.from('users').select('id, email');
  if (error) throw error;
  console.log(`Resetting ${users.length} users to the default password on ${url}`);
  let ok = 0;
  for (const u of users) {
    // email_confirm:true also fixes accounts created via the old invite flow
    // that were never confirmed (no SMTP) — otherwise login fails despite a
    // valid password with "Email not confirmed".
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, {
      password: DEFAULT_PASSWORD,
      email_confirm: true,
    });
    if (upErr) {
      console.error(`  FAILED ${u.email}: ${upErr.message}`);
    } else {
      ok++;
      console.log(`  reset  ${u.email}`);
    }
  }
  console.log(`\nDone. ${ok}/${users.length} reset. Default password: ${DEFAULT_PASSWORD}`);
}

main().catch((err) => {
  console.error('\nReset failed:', err.message || err);
  process.exit(1);
});
