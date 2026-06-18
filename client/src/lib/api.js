// Thin API helper. Every call carries the current Supabase access token so the
// server can act AS THE USER (RLS applies). The server — not this client — is
// the security boundary (PRD §3); this is just transport.

import { supabase } from './supabase.js';

// Where API calls go. Resolution order:
//   1. VITE_API_BASE_URL if set (lets you point at any backend per-deploy).
//   2. Otherwise, in a production build, the deployed Railway backend.
//   3. Otherwise (local dev), '' → relative /api paths that Vite's dev server
//      proxies to localhost:4000 (see vite.config.js).
// The production default means the deployed site works even if the hosting
// platform's env var is missing/misconfigured; the env var still overrides it.
const PROD_API_BASE = 'https://project-tracker-production-6516.up.railway.app';
const API_BASE =
  import.meta.env.VITE_API_BASE_URL || (import.meta.env.PROD ? PROD_API_BASE : '');

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  const headers = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // Surface the server's message (e.g. validation text) to the caller.
    const err = new Error(data.error || `${method} ${path} failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  listProjects: () => request('GET', '/api/projects').then((d) => d.projects),
  getProject: (id) => request('GET', `/api/projects/${id}`),
  createProject: (payload) => request('POST', '/api/projects', payload).then((d) => d.project),
  listUsers: () => request('GET', '/api/users').then((d) => d.users),

  // Files (PRD §15). Upload uses multipart/form-data — do NOT set Content-Type;
  // the browser adds the multipart boundary itself.
  uploadFile: async (projectId, file) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/projects/${projectId}/files`, {
      method: 'POST',
      headers: { ...(await authHeader()) },
      body: form,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data.file;
  },
  getFileUrl: (id) => request('GET', `/api/files/${id}/url`),
  deleteFile: (id) => request('DELETE', `/api/files/${id}`),

  // Admin — user management (PRD §16).
  adminListUsers: () => request('GET', '/api/admin/users').then((d) => d.users),
  adminCreateUser: (payload) => request('POST', '/api/admin/users', payload).then((d) => d.user),
  adminUpdateUser: (id, patch) => request('PATCH', `/api/admin/users/${id}`, patch),
  adminGetMappings: () => request('GET', '/api/admin/mappings'),
  adminAddMapping: (viewer_user_id, owner_user_id) =>
    request('POST', '/api/admin/mappings', { viewer_user_id, owner_user_id }),
  adminDeleteMapping: (id) => request('DELETE', `/api/admin/mappings/${id}`),

  // Edit mode (PRD §11).
  updateProject: (id, patch) => request('PATCH', `/api/projects/${id}`, patch),
  addMilestone: (projectId, payload) =>
    request('POST', `/api/projects/${projectId}/milestones`, payload),
  updateMilestone: (id, patch) => request('PATCH', `/api/milestones/${id}`, patch),
  deleteMilestone: (id) => request('DELETE', `/api/milestones/${id}`),
  addTask: (projectId, payload) => request('POST', `/api/projects/${projectId}/tasks`, payload),
  updateTask: (id, patch) => request('PATCH', `/api/tasks/${id}`, patch),
  deleteTask: (id) => request('DELETE', `/api/tasks/${id}`),
  postUpdate: (taskId, body) => request('POST', `/api/tasks/${taskId}/updates`, { body }),
  editUpdate: (id, body) => request('PATCH', `/api/updates/${id}`, { body }),
};
