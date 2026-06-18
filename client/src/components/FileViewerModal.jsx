// In-app file viewer (PRD §15.1). PDFs and images render inside a modal so the
// reviewer never leaves the tool. Types we can't render in-app (DOCX/XLSX) fall
// back to download-and-open, with brief messaging. Files are served via a
// short-lived signed URL fetched from the API (the bucket stays private). The
// viewer opens centered and can be expanded to fill the screen; any file can be
// downloaded from the header.

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const RENDERABLE = new Set(['pdf', 'png', 'jpg']);

// Append Supabase's `download` query param so the signed URL responds with
// Content-Disposition: attachment. A plain cross-origin <a download> is ignored
// by browsers (the storage bucket is a different origin), so this is what
// actually forces a save rather than navigating to the file.
function toDownloadUrl(url, name) {
  if (!url) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}download=${encodeURIComponent(name)}`;
}

export default function FileViewerModal({ file, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [fullscreen, setFullscreen] = useState(false);
  const renderable = RENDERABLE.has(file.file_type);

  useEffect(() => {
    let active = true;
    api
      .getFileUrl(file.id)
      .then((d) => {
        if (!active) return;
        setUrl(d.url);
        // Graceful fallback (§15.1): unrenderable types download then open.
        if (!RENDERABLE.has(file.file_type)) {
          const a = document.createElement('a');
          a.href = toDownloadUrl(d.url, d.file_name || file.file_name);
          a.download = d.file_name || file.file_name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      })
      .catch((e) => active && setError(e.message || 'Could not open the file.'));
    return () => {
      active = false;
    };
  }, [file]);

  // Esc closes the viewer; lock background scroll while it's open so full
  // screen is truly edge-to-edge and the page can't scroll behind the modal.
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return (
    <div className={`modal-backdrop${fullscreen ? ' fullscreen' : ''}`} onMouseDown={onClose}>
      <div
        className={`modal viewer-modal${fullscreen ? ' fullscreen' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={file.file_name}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="viewer-head">
          <span className="viewer-name">{file.file_name}</span>
          <div className="viewer-actions">
            {url && (
              <a
                className="ghost-button small"
                href={toDownloadUrl(url, file.file_name)}
                download={file.file_name}
              >
                Download
              </a>
            )}
            <button
              type="button"
              className="ghost-button small"
              aria-pressed={fullscreen}
              onClick={() => setFullscreen((v) => !v)}
            >
              {fullscreen ? 'Exit full screen' : 'Full screen'}
            </button>
            <button type="button" className="ghost-button small" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        {error && (
          <p className="auth-error" role="alert">
            {error}
          </p>
        )}

        {!error && !url && <p className="muted">Opening…</p>}

        {url && renderable && file.file_type === 'pdf' && (
          <iframe className="viewer-frame" src={url} title={file.file_name} />
        )}
        {url && renderable && file.file_type !== 'pdf' && (
          <img className="viewer-image" src={url} alt={file.file_name} />
        )}
        {url && !renderable && (
          <div className="viewer-fallback">
            <p>This file type can't be shown in-app — downloading it for you to open…</p>
            <a className="primary-button" href={toDownloadUrl(url, file.file_name)} download={file.file_name}>
              Download again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
