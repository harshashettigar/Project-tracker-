// Additional Files strip (PRD §10.2 / §15). Each entry shows a type icon, name,
// size and who attached it, and opens in the in-app viewer (§15.1). In Edit mode
// it also offers attach (with client-side type/size pre-checks mirroring §15.2;
// the server is authoritative) and remove.

import { useRef, useState } from 'react';
import { api } from '../lib/api.js';
import { formatBytes } from '../lib/format.js';
import FileViewerModal from './FileViewerModal.jsx';

const ALLOWED_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'docx', 'xlsx'];
const MAX_BYTES = 25 * 1024 * 1024;
const ICON = { pdf: '📄', png: '🖼', jpg: '🖼', docx: '📝', xlsx: '📊' };

export default function FilesSection({ projectId, files, editing, reload }) {
  const [viewing, setViewing] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (inputRef.current) inputRef.current.value = ''; // allow re-picking same file
    if (!file) return;
    setError('');

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!ALLOWED_EXT.includes(ext))
      return setError('Unsupported file type. Allowed: PDF, PNG, JPG, DOCX, XLSX.');
    if (file.size > MAX_BYTES) return setError('File is too large (max 25 MB).');

    setBusy(true);
    try {
      await api.uploadFile(projectId, file);
      await reload();
    } catch (err) {
      setError(err.message || 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }

  async function remove(f) {
    if (!window.confirm(`Remove file "${f.file_name}"?`)) return;
    setBusy(true);
    setError('');
    try {
      await api.deleteFile(f.id);
      await reload();
    } catch (err) {
      setError(err.message || 'Could not remove the file.');
    } finally {
      setBusy(false);
    }
  }

  // View mode with no files: render nothing (§19.2 keeps the screen calm).
  if (!editing && files.length === 0) return null;

  return (
    <section className="strip">
      <h2 className="section-title">Additional Files</h2>

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 ? (
        <ul className="file-strip">
          {files.map((f) => (
            <li key={f.id} className="file-chip">
              <button type="button" className="file-open" onClick={() => setViewing(f)}>
                <span aria-hidden="true">{ICON[f.file_type] || '📎'}</span>
                <span className="file-meta">
                  <span className="file-name">{f.file_name}</span>
                  <span className="file-sub">
                    {formatBytes(f.size_bytes)}
                    {f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ''}
                  </span>
                </span>
              </button>
              {editing && (
                <button
                  type="button"
                  className="file-remove"
                  title="Remove file"
                  disabled={busy}
                  onClick={() => remove(f)}
                >
                  ✕
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        editing && <p className="muted">No files attached yet.</p>
      )}

      {editing && (
        <div className="file-attach">
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
            disabled={busy}
            onChange={onPick}
          />
          {busy && <span className="muted">Uploading…</span>}
        </div>
      )}

      {viewing && <FileViewerModal file={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
