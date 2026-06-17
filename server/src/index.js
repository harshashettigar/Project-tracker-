// Project Tracker — stateless Express JSON API (PRD §3).
// Phase 0: skeleton only. Just enough to prove the server boots and can reach
// Supabase. Feature routes arrive in later phases (auth shell, list, detail, …).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';

// .env lives at the repo root, two levels above server/src/.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { serviceClient, clientForToken } = await import('./supabase.js');

const app = express();
app.use(cors());
app.use(express.json());

// Pull the bearer token off the Authorization header, or null.
function bearerToken(req) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

// Liveness — does the process serve requests?
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'project-tracker-api' });
});

// Readiness — can we reach the database? Counts users via the service client.
// (Service role bypasses RLS; this is a server-side health check only.)
app.get('/api/health/db', async (_req, res) => {
  if (!serviceClient) {
    return res.status(503).json({ ok: false, error: 'service role key not configured' });
  }
  const { error, count } = await serviceClient
    .from('users')
    .select('*', { count: 'exact', head: true });
  if (error) {
    return res.status(503).json({ ok: false, error: error.message });
  }
  res.json({ ok: true, users: count });
});

// Current user's profile. The security gate for sign-in: an authenticated token
// is not enough — the app's users row must exist and be active (PRD §8.3). This
// is enforced here (server-side), never in the UI alone (PRD §3). The request is
// made AS THE USER so RLS applies; a user may read their own row.
app.get('/api/me', async (req, res) => {
  const token = bearerToken(req);
  if (!token) {
    return res.status(401).json({ ok: false, error: 'missing token' });
  }

  const supabase = clientForToken(token);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    return res.status(401).json({ ok: false, error: 'invalid token' });
  }

  const { data: profile, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('id', auth.user.id)
    .single();

  if (error || !profile) {
    return res.status(403).json({ ok: false, error: 'no profile' });
  }
  if (profile.status !== 'active') {
    return res.status(403).json({ ok: false, error: 'inactive' });
  }

  res.json({ ok: true, user: profile });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Project Tracker API listening on http://localhost:${port}`);
});
