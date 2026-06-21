// One-off Phase 5 setup: create the PRIVATE Supabase Storage bucket that holds
// attachments (PRD §15). Private = no public URLs; the API serves files via
// short-lived signed URLs, so the server stays the security boundary (§3).
//
// Uses the SERVICE_ROLE key over HTTPS (the office network blocks Postgres ports
// but 443 is open — see CLAUDE.md). Run once:
//
//   cd server && npm install && npm run setup:storage
//
// Idempotent: re-running leaves an existing bucket as-is.

import '../src/env.js'; // mode-aware env load (+ banner). Pass --prod to target prod.
import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY (see .env).');
  process.exit(1);
}

const BUCKET = process.env.ATTACHMENTS_BUCKET || 'attachments';
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

const { data: existing } = await admin.storage.getBucket(BUCKET);
if (existing) {
  console.log(`Bucket "${BUCKET}" already exists (public=${existing.public}).`);
  process.exit(0);
}

const { error } = await admin.storage.createBucket(BUCKET, {
  public: false,
  fileSizeLimit: '25MB', // mirrors the §15.2 cap; the API enforces it too
  allowedMimeTypes: [
    'application/pdf',
    'image/png',
    'image/jpeg',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],
});
if (error) {
  console.error('Failed to create bucket:', error.message);
  process.exit(1);
}
console.log(`Created private bucket "${BUCKET}".`);
