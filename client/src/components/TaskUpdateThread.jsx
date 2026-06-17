// Task update thread (PRD §13) — the canonical, reusable way updates are shown
// anywhere. The latest update is highlighted (tinted + amber left border) and
// always visible; the entry just before it shows as a lighter one-line context.
// "History" expands the full record newest-first, beginning at the second-most-
// recent entry (the highlighted latest is not repeated). "No updates yet" when
// empty. View-mode only here; the Edit-mode composer arrives in Phase 4 (§11.4).

import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import Avatar from './Avatar.jsx';

export default function TaskUpdateThread({ updates }) {
  const [showHistory, setShowHistory] = useState(false);

  if (!updates || updates.length === 0) {
    return <div className="update-empty">No updates yet</div>;
  }

  const latest = updates[0];
  const predecessor = updates[1];
  const history = updates.slice(1); // newest-first, latest excluded (§13)

  return (
    <div className="update-thread">
      <div className="update latest">
        <div className="update-meta">
          <Avatar name={latest.author_name} size={20} />
          <span className="update-author">{latest.author_name ?? 'Unknown'}</span>
          <span className="update-date">{formatDate(latest.created_at)}</span>
        </div>
        <div className="update-body">{latest.body}</div>
      </div>

      {/* Collapsed: one-line predecessor for context. */}
      {predecessor && !showHistory && (
        <div className="update-context" title={predecessor.body}>
          <span className="update-author">{predecessor.author_name ?? 'Unknown'}</span>
          <span className="update-date">{formatDate(predecessor.created_at)}</span>
          <span className="update-context-body">{predecessor.body}</span>
        </div>
      )}

      {/* Expanded: full history newest-first, starting after the latest. */}
      {showHistory && (
        <div className="update-history">
          {history.map((u) => (
            <div className="update history" key={u.id}>
              <div className="update-meta">
                <Avatar name={u.author_name} size={20} />
                <span className="update-author">{u.author_name ?? 'Unknown'}</span>
                <span className="update-date">{formatDate(u.created_at)}</span>
              </div>
              <div className="update-body">{u.body}</div>
            </div>
          ))}
        </div>
      )}

      {updates.length > 1 && (
        <button
          type="button"
          className="link-button history-toggle"
          aria-expanded={showHistory}
          onClick={() => setShowHistory((v) => !v)}
        >
          {showHistory ? 'Hide history' : 'History'}
        </button>
      )}
    </div>
  );
}
