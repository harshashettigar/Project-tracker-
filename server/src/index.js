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

const { serviceClient } = await import('./supabase.js');

const app = express();
app.use(cors());
app.use(express.json());

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

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Project Tracker API listening on http://localhost:${port}`);
});
