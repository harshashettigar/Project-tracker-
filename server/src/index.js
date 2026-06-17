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

// The shared sign-in gate (PRD §3/§8.3). Resolves the caller to a user-scoped
// Supabase client (so RLS applies to every query) plus their active app profile.
// On any failure it writes the response and returns null, so callers do:
//   const ctx = await requireActiveUser(req, res); if (!ctx) return;
async function requireActiveUser(req, res) {
  const token = bearerToken(req);
  if (!token) {
    res.status(401).json({ ok: false, error: 'missing token' });
    return null;
  }
  const supabase = clientForToken(token);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth?.user) {
    res.status(401).json({ ok: false, error: 'invalid token' });
    return null;
  }
  const { data: profile, error } = await supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .eq('id', auth.user.id)
    .single();
  if (error || !profile) {
    res.status(403).json({ ok: false, error: 'no profile' });
    return null;
  }
  if (profile.status !== 'active') {
    res.status(403).json({ ok: false, error: 'inactive' });
    return null;
  }
  return { supabase, profile };
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
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  res.json({ ok: true, user: ctx.profile });
});

// Staff directory (PRD §21.1): any authenticated user may read it — needed for
// the owner picker (§9.4) and owner filter (§9.5). RLS already allows this read.
app.get('/api/users', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { data, error } = await ctx.supabase
    .from('users')
    .select('id, full_name, email, role, status')
    .order('full_name');
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true, users: data });
});

// Derived target date (PRD §12.2) for a set of project ids: the latest target
// across each project's milestones and its direct (no-milestone) tasks, or null.
// Computed from RLS-scoped child rows (not the bypassing view) — see decisions.md.
async function deriveTargets(supabase, ids) {
  const byProject = new Map();
  if (!ids.length) return byProject;
  const [{ data: ms }, { data: ts }] = await Promise.all([
    supabase.from('milestones').select('project_id, target_date').in('project_id', ids),
    supabase
      .from('tasks')
      .select('project_id, target_date')
      .is('milestone_id', null)
      .in('project_id', ids),
  ]);
  for (const row of [...(ms || []), ...(ts || [])]) {
    if (!row.target_date) continue;
    const cur = byProject.get(row.project_id);
    if (!cur || row.target_date > cur) byProject.set(row.project_id, row.target_date);
  }
  return byProject;
}

// Project list (PRD §9). Returns only top-level projects the caller may see —
// the visibility model is enforced by RLS on `projects` (PRD §3/§17), not here;
// this endpoint simply queries AS THE USER. Target date is derived (§12.2): the
// latest target across the project's milestones and its direct (no-milestone)
// tasks, or null when none. We compute it from RLS-scoped child rows rather than
// the bypassing view, so a user never sees data for a project they can't see.
app.get('/api/projects', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const { data: projects, error } = await supabase
    .from('projects')
    .select('id, name, owner_user_id, status, start_date, objective')
    .is('parent_project_id', null)
    .order('name');
  if (error) return res.status(500).json({ ok: false, error: error.message });

  const ids = projects.map((p) => p.id);
  const targetByProject = await deriveTargets(supabase, ids);

  // Owner names for the Responsible column (§9.3). Directory read is RLS-allowed.
  const { data: users } = await supabase.from('users').select('id, full_name');
  const nameById = new Map((users || []).map((u) => [u.id, u.full_name]));

  const rows = projects.map((p) => ({
    id: p.id,
    name: p.name,
    status: p.status,
    start_date: p.start_date,
    target_date: targetByProject.get(p.id) ?? null,
    owner_user_id: p.owner_user_id,
    owner_name: nameById.get(p.owner_user_id) ?? null,
  }));
  res.json({ ok: true, projects: rows });
});

// Create a project (PRD §9.4). Name required; owner defaults to the caller; new
// projects start as Draft with no target date (derived later). Viewers cannot
// create (PRD §18) — enforced here at the API, and RLS still gates ownership.
app.post('/api/projects', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;

  if (profile.role === 'viewer') {
    return res.status(403).json({ ok: false, error: 'viewers cannot create projects' });
  }

  const name = (req.body?.name || '').trim();
  if (!name) {
    return res.status(400).json({ ok: false, error: 'Project name is required.' });
  }

  const objective = req.body?.objective?.trim() || null;
  // Owner defaults to the caller; only admins may set someone else (RLS also
  // enforces this — a non-admin insert with a foreign owner is rejected).
  const owner_user_id =
    profile.role === 'admin' && req.body?.owner_user_id ? req.body.owner_user_id : profile.id;
  // Default start date to today (server clock) when the client omits it.
  const start_date = req.body?.start_date || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, objective, owner_user_id, start_date, status: 'draft' })
    .select('id, name, status, start_date, owner_user_id')
    .single();
  if (error) return res.status(400).json({ ok: false, error: error.message });

  res.status(201).json({ ok: true, project: data });
});

// Project detail (PRD §10). Returns one project the caller may see, with its
// milestones (each with their tasks), project-level tasks, every task's update
// thread (newest-first, §13), the file strip (§15) and sub-project links (§14).
// RLS scopes every read; an invisible (or missing) project yields 404.
app.get('/api/projects/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase } = ctx;
  const { id } = req.params;

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, name, owner_user_id, status, start_date, objective, parent_project_id')
    .eq('id', id)
    .maybeSingle();
  if (error) return res.status(500).json({ ok: false, error: error.message });
  if (!project) return res.status(404).json({ ok: false, error: 'not found' });

  // Children, all RLS-scoped to projects the caller can see.
  const [{ data: milestones }, { data: tasks }, { data: files }, { data: subs }] =
    await Promise.all([
      supabase
        .from('milestones')
        .select('id, name, target_date, status, sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      supabase
        .from('tasks')
        .select('id, milestone_id, name, start_date, target_date, status, sort_order')
        .eq('project_id', id)
        .order('sort_order'),
      supabase
        .from('attachments')
        .select('id, file_name, file_type, size_bytes')
        .eq('project_id', id),
      supabase
        .from('projects')
        .select('id, name, status')
        .eq('parent_project_id', id)
        .order('name'),
    ]);

  const taskIds = (tasks || []).map((t) => t.id);
  let updates = [];
  if (taskIds.length) {
    const { data } = await supabase
      .from('task_updates')
      .select('id, task_id, body, created_at, author_user_id')
      .in('task_id', taskIds)
      .order('created_at', { ascending: false }); // newest-first (§13)
    updates = data || [];
  }

  // Names: owner, parent, and update authors. Directory read is RLS-allowed.
  const { data: users } = await supabase.from('users').select('id, full_name');
  const nameById = new Map((users || []).map((u) => [u.id, u.full_name]));

  let parentName = null;
  if (project.parent_project_id) {
    const { data: parent } = await supabase
      .from('projects')
      .select('name')
      .eq('id', project.parent_project_id)
      .maybeSingle();
    parentName = parent?.name ?? null;
  }

  // Group updates under their task (already newest-first).
  const updatesByTask = new Map();
  for (const u of updates) {
    const row = {
      id: u.id,
      body: u.body,
      created_at: u.created_at,
      author_name: nameById.get(u.author_user_id) ?? null,
    };
    if (!updatesByTask.has(u.task_id)) updatesByTask.set(u.task_id, []);
    updatesByTask.get(u.task_id).push(row);
  }
  const shapeTask = (t) => ({
    id: t.id,
    name: t.name,
    start_date: t.start_date,
    target_date: t.target_date,
    status: t.status,
    updates: updatesByTask.get(t.id) || [],
  });

  // Tasks split into milestone-scoped and project-level (milestone_id null).
  const tasksByMilestone = new Map();
  const projectTasks = [];
  for (const t of tasks || []) {
    if (t.milestone_id) {
      if (!tasksByMilestone.has(t.milestone_id)) tasksByMilestone.set(t.milestone_id, []);
      tasksByMilestone.get(t.milestone_id).push(shapeTask(t));
    } else {
      projectTasks.push(shapeTask(t));
    }
  }

  const targets = await deriveTargets(supabase, [id]);

  res.json({
    ok: true,
    project: {
      id: project.id,
      name: project.name,
      status: project.status,
      start_date: project.start_date,
      objective: project.objective,
      owner_user_id: project.owner_user_id,
      owner_name: nameById.get(project.owner_user_id) ?? null,
      parent_project_id: project.parent_project_id,
      parent_name: parentName,
      target_date: targets.get(id) ?? null,
    },
    milestones: (milestones || []).map((m) => ({
      id: m.id,
      name: m.name,
      target_date: m.target_date,
      status: m.status,
      tasks: tasksByMilestone.get(m.id) || [],
    })),
    projectTasks,
    files: files || [],
    subProjects: subs || [],
  });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Project Tracker API listening on http://localhost:${port}`);
});
