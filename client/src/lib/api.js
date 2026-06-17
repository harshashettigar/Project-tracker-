// Thin API helper. Every call carries the current Supabase access token so the
// server can act AS THE USER (RLS applies). The server — not this client — is
// the security boundary (PRD §3); this is just transport.

import { supabase } from './supabase.js';

async function authHeader() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request(method, path, body) {
  const headers = { ...(await authHeader()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const res = await fetch(path, {
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
};
