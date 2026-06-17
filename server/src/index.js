// Project Tracker — stateless Express JSON API (PRD §3).
// Phase 0: skeleton only. Just enough to prove the server boots and can reach
// Supabase. Feature routes arrive in later phases (auth shell, list, detail, …).

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import multer from 'multer';

// .env lives at the repo root, two levels above server/src/.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env') });

const { serviceClient, clientForToken } = await import('./supabase.js');
const { scanFile } = await import('./scan.js');

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

// Canonical entity status set (PRD §7.2). Any write naming a status is checked.
const STATUS_VALUES = new Set(['draft', 'in_progress', 'on_hold', 'completed', 'at_risk']);

// File attachments (PRD §15). Private bucket; the API serves signed URLs.
const ATTACHMENTS_BUCKET = process.env.ATTACHMENTS_BUCKET || 'attachments';
const MAX_FILE_BYTES = 25 * 1024 * 1024; // ~25 MB cap (§15.2)

// Allow-list (§15.2): extension → { file_type enum, accepted MIME(s), magic test }.
// We validate extension AND declared MIME AND leading "magic" bytes so a file
// can't lie about its type. DOCX/XLSX are ZIP containers, so they share the ZIP
// signature and are disambiguated by extension + MIME.
const ZIP_MAGIC = (b) => b[0] === 0x50 && b[1] === 0x4b; // "PK"
const ALLOWED_TYPES = {
  pdf: {
    type: 'pdf',
    mimes: ['application/pdf'],
    magic: (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46, // %PDF
  },
  png: {
    type: 'png',
    mimes: ['image/png'],
    magic: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  jpg: {
    type: 'jpg',
    mimes: ['image/jpeg'],
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  jpeg: {
    type: 'jpg',
    mimes: ['image/jpeg'],
    magic: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  docx: {
    type: 'docx',
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    magic: ZIP_MAGIC,
  },
  xlsx: {
    type: 'xlsx',
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
    magic: ZIP_MAGIC,
  },
};
const WRONG_TYPE_MSG = 'Unsupported file type. Allowed: PDF, PNG, JPG, DOCX, XLSX.';

// In-memory upload so the server can validate + scan the bytes before storing.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_FILE_BYTES } });

// Can the caller edit this project? Owner or admin (PRD §18). Reads the project
// AS THE USER, so an invisible project also yields false. RLS is the real gate;
// this gives a clean 403 instead of a silent policy rejection.
async function canEditProject(supabase, profile, projectId) {
  if (profile.role === 'admin') {
    // Admin can edit any project that exists; confirm it does (RLS lets admin see all).
    const { data } = await supabase.from('projects').select('id').eq('id', projectId).maybeSingle();
    return !!data;
  }
  const { data } = await supabase
    .from('projects')
    .select('owner_user_id')
    .eq('id', projectId)
    .maybeSingle();
  return !!data && data.owner_user_id === profile.id;
}

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

// Validate a prospective parent for a sub-project link (PRD §14). The caller must
// be able to edit the parent, the parent must itself be top-level (one level
// only), and the child (if it already exists) must have no children of its own.
// Returns null if OK, or { status, error } to send. The DB trigger is the final
// backstop; this just yields clean messages.
async function validateParentLink(supabase, profile, parentId, childId) {
  if (childId && parentId === childId)
    return { status: 400, error: "A project can't be its own parent." };
  if (!(await canEditProject(supabase, profile, parentId)))
    return { status: 403, error: 'You can only nest under a project you can edit.' };
  const { data: parent } = await supabase
    .from('projects')
    .select('parent_project_id')
    .eq('id', parentId)
    .maybeSingle();
  if (!parent) return { status: 400, error: 'Parent project not found.' };
  if (parent.parent_project_id)
    return { status: 400, error: 'Sub-projects are one level only.' };
  if (childId) {
    const { count } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .eq('parent_project_id', childId);
    if (count > 0)
      return { status: 400, error: 'This project has sub-projects and cannot become one.' };
  }
  return null;
}

// Create a project (PRD §9.4). Name required; owner defaults to the caller; new
// projects start as Draft with no target date (derived later). Viewers cannot
// create (PRD §18) — enforced here at the API, and RLS still gates ownership.
// An optional parent_project_id makes it a sub-project (§14, one level only).
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

  const parent_project_id = req.body?.parent_project_id || null;
  if (parent_project_id) {
    const bad = await validateParentLink(supabase, profile, parent_project_id, null);
    if (bad) return res.status(bad.status).json({ ok: false, error: bad.error });
  }

  const { data, error } = await supabase
    .from('projects')
    .insert({ name, objective, owner_user_id, start_date, status: 'draft', parent_project_id })
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
        .select('id, file_name, file_type, size_bytes, uploaded_by, created_at')
        .eq('project_id', id)
        .order('created_at'),
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
    files: (files || []).map((f) => ({
      id: f.id,
      file_name: f.file_name,
      file_type: f.file_type,
      size_bytes: f.size_bytes,
      uploaded_by_name: nameById.get(f.uploaded_by) ?? null,
    })),
    subProjects: subs || [],
  });
});

// ==========================================================================
// Edit mode (PRD §11). Every write acts AS THE USER, so RLS (can_edit_project,
// append-only task_updates) is the real boundary; the canEditProject() checks
// below just turn policy rejections into clean 403s. Target date is never
// written — it stays derived (§12.2).
// ==========================================================================

// Edit the project summary + objective (§11.2). Owner/admin only. Owner may be
// reassigned only by an admin (RLS WITH CHECK enforces this regardless).
app.patch('/api/projects/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  if (!(await canEditProject(supabase, profile, id))) {
    return res.status(403).json({ ok: false, error: 'not allowed' });
  }

  const patch = {};
  if ('name' in req.body) {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Project name is required.' });
    patch.name = name;
  }
  if ('objective' in req.body) patch.objective = req.body.objective?.trim() || null;
  if ('start_date' in req.body) patch.start_date = req.body.start_date || null;
  if ('status' in req.body) {
    if (!STATUS_VALUES.has(req.body.status))
      return res.status(400).json({ ok: false, error: 'Invalid status.' });
    patch.status = req.body.status;
  }
  if ('owner_user_id' in req.body) {
    if (profile.role !== 'admin')
      return res.status(403).json({ ok: false, error: 'only an admin can reassign owner' });
    patch.owner_user_id = req.body.owner_user_id;
  }
  // Link / unlink as a sub-project (§14). Null detaches (back to top-level).
  if ('parent_project_id' in req.body) {
    const newParent = req.body.parent_project_id || null;
    if (newParent) {
      const bad = await validateParentLink(supabase, profile, newParent, id);
      if (bad) return res.status(bad.status).json({ ok: false, error: bad.error });
    }
    patch.parent_project_id = newParent;
  }
  if (Object.keys(patch).length === 0)
    return res.status(400).json({ ok: false, error: 'nothing to update' });

  const { error } = await supabase.from('projects').update(patch).eq('id', id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

// Add a milestone (§11.3). Name + target date both required (§12.1/§19.1).
app.post('/api/projects/:id/milestones', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  if (!(await canEditProject(supabase, profile, id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, error: 'Milestone name is required.' });
  if (!req.body?.target_date)
    return res.status(400).json({ ok: false, error: 'Milestone target date is required.' });
  const status = req.body.status && STATUS_VALUES.has(req.body.status) ? req.body.status : 'draft';

  const { data, error } = await supabase
    .from('milestones')
    .insert({ project_id: id, name, target_date: req.body.target_date, status })
    .select('id')
    .single();
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(201).json({ ok: true, milestone: data });
});

// Edit a milestone (§11.2): rename, retarget, restatus, reorder. Target stays
// required — it can't be cleared (§12.1).
app.patch('/api/milestones/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  const { data: m } = await supabase
    .from('milestones')
    .select('project_id')
    .eq('id', id)
    .maybeSingle();
  if (!m) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, m.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const patch = {};
  if ('name' in req.body) {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Milestone name is required.' });
    patch.name = name;
  }
  if ('target_date' in req.body) {
    if (!req.body.target_date)
      return res.status(400).json({ ok: false, error: 'Milestone target date is required.' });
    patch.target_date = req.body.target_date;
  }
  if ('status' in req.body) {
    if (!STATUS_VALUES.has(req.body.status))
      return res.status(400).json({ ok: false, error: 'Invalid status.' });
    patch.status = req.body.status;
  }
  if ('sort_order' in req.body) patch.sort_order = req.body.sort_order;
  if (Object.keys(patch).length === 0)
    return res.status(400).json({ ok: false, error: 'nothing to update' });

  const { error } = await supabase.from('milestones').update(patch).eq('id', id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

app.delete('/api/milestones/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  const { data: m } = await supabase
    .from('milestones')
    .select('project_id')
    .eq('id', id)
    .maybeSingle();
  if (!m) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, m.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const { error } = await supabase.from('milestones').delete().eq('id', id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

// Add a task (§11.3). Required fields are context-dependent (§12.1): a task with
// no milestone needs a target date; a milestone-scoped task does not.
app.post('/api/projects/:id/tasks', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  if (!(await canEditProject(supabase, profile, id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const name = (req.body?.name || '').trim();
  if (!name) return res.status(400).json({ ok: false, error: 'Task name is required.' });
  const milestone_id = req.body?.milestone_id || null;
  const target_date = req.body?.target_date || null;
  if (!milestone_id && !target_date)
    return res
      .status(400)
      .json({ ok: false, error: 'Target date is required for project-level tasks.' });
  const status = req.body.status && STATUS_VALUES.has(req.body.status) ? req.body.status : 'draft';

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      project_id: id,
      milestone_id,
      name,
      start_date: req.body?.start_date || null,
      target_date,
      status,
    })
    .select('id')
    .single();
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(201).json({ ok: true, task: data });
});

// Edit a task (§11.2). Re-validates §12.1 on the merged result so a project-level
// task can never end up without a target date (the DB CHECK is the backstop).
app.patch('/api/tasks/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  const { data: t } = await supabase
    .from('tasks')
    .select('project_id, milestone_id, target_date')
    .eq('id', id)
    .maybeSingle();
  if (!t) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, t.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const patch = {};
  if ('name' in req.body) {
    const name = (req.body.name || '').trim();
    if (!name) return res.status(400).json({ ok: false, error: 'Task name is required.' });
    patch.name = name;
  }
  if ('start_date' in req.body) patch.start_date = req.body.start_date || null;
  if ('target_date' in req.body) patch.target_date = req.body.target_date || null;
  if ('milestone_id' in req.body) patch.milestone_id = req.body.milestone_id || null;
  if ('status' in req.body) {
    if (!STATUS_VALUES.has(req.body.status))
      return res.status(400).json({ ok: false, error: 'Invalid status.' });
    patch.status = req.body.status;
  }
  if ('sort_order' in req.body) patch.sort_order = req.body.sort_order;
  if (Object.keys(patch).length === 0)
    return res.status(400).json({ ok: false, error: 'nothing to update' });

  // §12.1: project-level (no milestone) task must keep a target date.
  const milestoneAfter = 'milestone_id' in patch ? patch.milestone_id : t.milestone_id;
  const targetAfter = 'target_date' in patch ? patch.target_date : t.target_date;
  if (!milestoneAfter && !targetAfter)
    return res
      .status(400)
      .json({ ok: false, error: 'Target date is required for project-level tasks.' });

  const { error } = await supabase.from('tasks').update(patch).eq('id', id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

app.delete('/api/tasks/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  const { data: t } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', id)
    .maybeSingle();
  if (!t) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, t.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.json({ ok: true });
});

// Post a task update (§11.4/§13). Append-only — never overwrites. Authorship is
// the project owner or an admin (RLS also enforces author = self + can_edit).
app.post('/api/tasks/:id/updates', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;
  const { id } = req.params;

  const { data: t } = await supabase
    .from('tasks')
    .select('project_id')
    .eq('id', id)
    .maybeSingle();
  if (!t) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, t.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const body = (req.body?.body || '').trim();
  if (!body) return res.status(400).json({ ok: false, error: 'Write an update first.' });

  const { data, error } = await supabase
    .from('task_updates')
    .insert({ task_id: id, author_user_id: profile.id, body })
    .select('id')
    .single();
  if (error) return res.status(400).json({ ok: false, error: error.message });
  res.status(201).json({ ok: true, update: data });
});

// ==========================================================================
// File attachments (PRD §15). Uploads flow THROUGH the API: validate (type +
// size), scan (§15.2), store into the private bucket via the service role, then
// record the row AS THE USER (RLS attachments_write_editor gates capability).
// Downloads are served as short-lived signed URLs so the bucket stays private.
// ==========================================================================

// Attach a file to a project (§11.2/§15.2). Owner/admin only.
app.post('/api/projects/:id/files', (req, res) => {
  upload.single('file')(req, res, async (uploadErr) => {
    if (uploadErr) {
      if (uploadErr.code === 'LIMIT_FILE_SIZE')
        return res.status(400).json({ ok: false, error: 'File is too large (max 25 MB).' });
      return res.status(400).json({ ok: false, error: 'Upload failed.' });
    }

    const ctx = await requireActiveUser(req, res);
    if (!ctx) return;
    const { supabase, profile } = ctx;
    const { id } = req.params;

    if (!(await canEditProject(supabase, profile, id)))
      return res.status(403).json({ ok: false, error: 'not allowed' });

    const file = req.file;
    if (!file) return res.status(400).json({ ok: false, error: 'No file provided.' });

    // Validate type: extension + declared MIME + magic bytes must all agree (§15.2).
    const ext = (file.originalname.split('.').pop() || '').toLowerCase();
    const spec = ALLOWED_TYPES[ext];
    if (!spec) return res.status(400).json({ ok: false, error: WRONG_TYPE_MSG });
    if (!spec.mimes.includes(file.mimetype))
      return res.status(400).json({ ok: false, error: WRONG_TYPE_MSG });
    if (!spec.magic(file.buffer))
      return res.status(400).json({ ok: false, error: WRONG_TYPE_MSG });
    if (file.size > MAX_FILE_BYTES)
      return res.status(400).json({ ok: false, error: 'File is too large (max 25 MB).' });

    // Scan BEFORE storing (§15.2). A non-clean verdict blocks the upload.
    const verdict = await scanFile(file.buffer, { name: file.originalname, type: spec.type });
    if (!verdict.clean)
      return res
        .status(422)
        .json({ ok: false, error: 'File failed the security scan and was not stored.' });

    // Store into the private bucket via the service role (bypasses storage ACLs).
    if (!serviceClient)
      return res.status(503).json({ ok: false, error: 'storage not configured' });
    const storagePath = `${id}/${randomUUID()}.${spec.type}`;
    const { error: upErr } = await serviceClient.storage
      .from(ATTACHMENTS_BUCKET)
      .upload(storagePath, file.buffer, { contentType: file.mimetype, upsert: false });
    if (upErr) return res.status(500).json({ ok: false, error: upErr.message });

    // Record the row AS THE USER so RLS confirms edit rights; roll back the
    // stored object if the insert is rejected.
    const { data, error } = await supabase
      .from('attachments')
      .insert({
        project_id: id,
        milestone_id: req.body?.milestone_id || null,
        task_id: req.body?.task_id || null,
        file_name: file.originalname,
        file_type: spec.type,
        size_bytes: file.size,
        storage_path: storagePath,
        uploaded_by: profile.id,
        scanned_at: new Date().toISOString(),
      })
      .select('id, file_name, file_type, size_bytes')
      .single();
    if (error) {
      await serviceClient.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
      return res.status(400).json({ ok: false, error: error.message });
    }
    res.status(201).json({ ok: true, file: data });
  });
});

// Signed URL to view/download a file (§15.1). Anyone who can see the project may
// read it — confirmed by reading the row AS THE USER (RLS scopes it).
app.get('/api/files/:id/url', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase } = ctx;

  const { data: row } = await supabase
    .from('attachments')
    .select('storage_path, file_name')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!row) return res.status(404).json({ ok: false, error: 'not found' });

  if (!serviceClient) return res.status(503).json({ ok: false, error: 'storage not configured' });
  const { data, error } = await serviceClient.storage
    .from(ATTACHMENTS_BUCKET)
    .createSignedUrl(row.storage_path, 120); // short-lived (2 min)
  if (error) return res.status(500).json({ ok: false, error: error.message });
  res.json({ ok: true, url: data.signedUrl, file_name: row.file_name });
});

// Remove a file (§11.2). Owner/admin only. Deletes the row then the object.
app.delete('/api/files/:id', async (req, res) => {
  const ctx = await requireActiveUser(req, res);
  if (!ctx) return;
  const { supabase, profile } = ctx;

  const { data: row } = await supabase
    .from('attachments')
    .select('project_id, storage_path')
    .eq('id', req.params.id)
    .maybeSingle();
  if (!row) return res.status(404).json({ ok: false, error: 'not found' });
  if (!(await canEditProject(supabase, profile, row.project_id)))
    return res.status(403).json({ ok: false, error: 'not allowed' });

  const { error } = await supabase.from('attachments').delete().eq('id', req.params.id);
  if (error) return res.status(400).json({ ok: false, error: error.message });
  if (serviceClient)
    await serviceClient.storage.from(ATTACHMENTS_BUCKET).remove([row.storage_path]);
  res.json({ ok: true });
});

const port = process.env.PORT || 4000;
app.listen(port, () => {
  console.log(`Project Tracker API listening on http://localhost:${port}`);
});
