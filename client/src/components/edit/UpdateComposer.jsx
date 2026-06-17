// Update composer (PRD §11.4 / §13). Opens pre-filled with the previous update's
// full text so the author edits forward from it. Append-only: posting never
// alters prior entries. Empty posts are blocked with the §19.1 prompt.

import { useState } from 'react';

export default function UpdateComposer({ latestBody = '', onPost, onCancel }) {
  const [text, setText] = useState(latestBody);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function post() {
    if (!text.trim()) {
      setError('Write an update first.'); // PRD §19.1, verbatim
      return;
    }
    setBusy(true);
    setError('');
    try {
      await onPost(text.trim());
    } catch (e) {
      setError(e.message || 'Could not post the update.');
      setBusy(false);
    }
    // On success the parent reloads the detail, unmounting this composer.
  }

  return (
    <div className="composer">
      {error && (
        <p className="auth-error" role="alert">
          {error}
        </p>
      )}
      <textarea
        rows={3}
        value={text}
        disabled={busy}
        autoFocus
        placeholder="Write an update…"
        onChange={(e) => setText(e.target.value)}
      />
      <div className="composer-actions">
        <button type="button" className="ghost-button" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="primary-button" onClick={post} disabled={busy}>
          {busy ? 'Posting…' : 'Post update'}
        </button>
      </div>
    </div>
  );
}
