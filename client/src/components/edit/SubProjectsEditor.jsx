// Sub-projects editor (PRD §14 / §11.2). In Edit mode an owner/admin can add a
// new child project, link an existing one, or unlink a child (which returns it to
// the top-level list). One level only: a project that is itself a sub-project
// cannot have children, so the add/link controls are hidden there (the DB trigger
// is the backstop). Unlink detaches — it does NOT delete the child project.

import { useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import { useAuth } from '../../auth/AuthProvider.jsx';
import StatusChip from '../StatusChip.jsx';

export default function SubProjectsEditor({ project, subProjects, onNavigate, reload }) {
  const { profile } = useAuth();
  const isChild = !!project.parent_project_id;

  const [candidates, setCandidates] = useState([]);
  const [linkId, setLinkId] = useState('');
  const [newName, setNewName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  // Candidates to link: top-level projects the caller can edit, excluding this
  // project and its current children. listProjects() returns only top-level rows.
  useEffect(() => {
    if (isChild) return;
    let active = true;
    api
      .listProjects()
      .then((all) => {
        if (!active) return;
        const childIds = new Set(subProjects.map((s) => s.id));
        const eligible = all.filter(
          (p) =>
            p.id !== project.id &&
            !childIds.has(p.id) &&
            (profile?.role === 'admin' || p.owner_user_id === profile?.id),
        );
        setCandidates(eligible);
      })
      .catch(() => active && setCandidates([]));
    return () => {
      active = false;
    };
  }, [isChild, project.id, subProjects, profile]);

  async function run(fn) {
    setBusy(true);
    setError('');
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(e.message || 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  }

  async function addNew() {
    if (!newName.trim()) return setError('Project name is required.');
    await run(async () => {
      await api.createProject({ name: newName.trim(), parent_project_id: project.id });
      setNewName('');
    });
  }

  async function linkExisting() {
    if (!linkId) return;
    await run(async () => {
      await api.updateProject(linkId, { parent_project_id: project.id });
      setLinkId('');
    });
  }

  function unlink(child) {
    if (!window.confirm(`Unlink "${child.name}" from this project? It returns to the top-level list.`))
      return;
    run(() => api.updateProject(child.id, { parent_project_id: null }));
  }

  return (
    <section className="strip">
      <h2 className="section-title">Sub Projects</h2>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {isChild ? (
        <p className="muted">Sub-projects are one level only — this project can't have its own.</p>
      ) : (
        <>
          {subProjects.length > 0 ? (
            <ul className="subproject-strip">
              {subProjects.map((sp) => (
                <li key={sp.id} className="subproject-edit-row">
                  <button
                    type="button"
                    className="subproject-link"
                    onClick={() => onNavigate({ name: 'detail', id: sp.id })}
                  >
                    {sp.name}
                    <StatusChip status={sp.status} />
                  </button>
                  <button
                    type="button"
                    className="file-remove"
                    title="Unlink"
                    disabled={busy}
                    onClick={() => unlink(sp)}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No sub-projects yet.</p>
          )}

          <div className="subproject-controls">
            <div className="subproject-add">
              <input
                type="text"
                placeholder="New sub-project name"
                value={newName}
                disabled={busy}
                onChange={(e) => setNewName(e.target.value)}
              />
              <button type="button" className="primary-button small" disabled={busy} onClick={addNew}>
                + Add new
              </button>
            </div>

            {candidates.length > 0 && (
              <div className="subproject-link-existing">
                <select value={linkId} disabled={busy} onChange={(e) => setLinkId(e.target.value)}>
                  <option value="">Link an existing project…</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="ghost-button small"
                  disabled={busy || !linkId}
                  onClick={linkExisting}
                >
                  Link
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
}
