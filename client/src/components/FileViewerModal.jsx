// In-app file viewer (PRD §15.1). PDFs and images render inside a modal so the
// reviewer never leaves the tool. Types we can't render in-app (DOCX/XLSX) fall
// back to download-and-open, with brief messaging. Files are served via a
// short-lived signed URL fetched from the API (the bucket stays private).

import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const RENDERABLE = new Set(['pdf', 'png', 'jpg']);

export default function FileViewerModal({ file, onClose }) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
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
          a.href = d.url;
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

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="modal viewer-modal"
        role="dialog"
        aria-modal="true"
        aria-label={file.file_name}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="viewer-head">
          <span className="viewer-name">{file.file_name}</span>
          <button type="button" className="ghost-button small" onClick={onClose}>
            Close
          </button>
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
            <a className="primary-button" href={url} download={file.file_name}>
              Download again
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
