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

// Per-type icon-square colours, echoing the reference design's coloured file
// chips (bg + matching foreground for the glyph).
const TYPE_STYLE = {
  pdf: { bg: '#fdecec', fg: '#c0392b' },
  docx: { bg: '#e7f0fb', fg: '#2b6aa8' },
  xlsx: { bg: '#e6f4ec', fg: '#2e7d4f' },
  png: { bg: '#f1ecfb', fg: '#6b4ea8' },
  jpg: { bg: '#f1ecfb', fg: '#6b4ea8' },
  jpeg: { bg: '#f1ecfb', fg: '#6b4ea8' },
};

// Single file glyph, coloured by type via the square's foreground (currentColor).
function FileGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

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
    <section className="strip detail-card">
      <div className="card-head">
        <h2 className="section-title">Additional files</h2>
        {editing && (
          <button
            type="button"
            className="ghost-button small"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
          >
            {busy ? 'Uploading…' : '↑ Attach'}
          </button>
        )}
      </div>

      {/* Hidden native picker, driven by the Attach button above. */}
      {editing && (
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.docx,.xlsx"
          disabled={busy}
          onChange={onPick}
          hidden
        />
      )}

      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}

      {files.length > 0 ? (
        <ul className="file-list">
          {files.map((f) => {
            const ts = TYPE_STYLE[f.file_type] || { bg: '#eef2f7', fg: '#3a6291' };
            const typeLabel = (f.file_type || '').toUpperCase();
            return (
              <li key={f.id} className="file-row">
                <button type="button" className="file-open" onClick={() => setViewing(f)}>
                  <span className="file-icon" style={{ background: ts.bg, color: ts.fg }}>
                    <FileGlyph />
                  </span>
                  <span className="file-meta">
                    <span className="file-name">{f.file_name}</span>
                    <span className="file-sub">
                      {[typeLabel, formatBytes(f.size_bytes), f.uploaded_by_name]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                </button>
                {editing ? (
                  <button
                    type="button"
                    className="file-remove"
                    title="Remove file"
                    disabled={busy}
                    onClick={() => remove(f)}
                  >
                    ✕
                  </button>
                ) : (
                  <span className="file-chevron" aria-hidden="true">
                    ›
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        editing && <p className="muted">No files attached yet.</p>
      )}

      {viewing && <FileViewerModal file={viewing} onClose={() => setViewing(null)} />}
    </section>
  );
}
