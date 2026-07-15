// Task update thread (PRD §13) — the canonical, reusable way updates are shown.
//
// Default (no `range`): the single latest update is highlighted (amber); the entry
// before it shows as one-line context; "History" expands the rest newest-first.
//
// With a review `range` (weekly-review period, post-v1): EVERY update that falls
// inside the window is highlighted together (a 2-week catch-up shows all of them,
// not just the last), and older updates drop into History. If the task had NO
// update in the window it isn't highlighted at all — its latest update shows in
// the plain "previous" style, so untouched tasks stay visible but don't draw the
// eye. "No updates yet" when empty.

import { useState } from 'react';
import { formatDate } from '../lib/format.js';
import { inRange } from '../period/PeriodContext.jsx';
import Avatar from './Avatar.jsx';

export default function TaskUpdateThread({ updates, range = null }) {
  const [showHistory, setShowHistory] = useState(false);

  if (!updates || updates.length === 0) {
    return <div className="update-empty">No updates yet</div>;
  }

  // `top` = the highlighted (amber) set; `rest` = everything else, newest-first.
  // - no range  → top is just the latest (today's behaviour)
  // - range hit → top is all in-window updates
  // - range miss→ top is empty (task untouched this period → no highlight)
  let top;
  if (range) {
    top = updates.filter((u) => inRange(u.created_at, range));
  } else {
    top = [updates[0]];
  }
  const inTop = new Set(top.map((u) => u.id));
  const rest = updates.filter((u) => !inTop.has(u.id));

  // Recency labels are about time, NOT about the review window: the single newest
  // update overall is always "Latest update" wherever it sits, and everything
  // older is "Previous update". The window only controls the amber HIGHLIGHT
  // (top). This prevents the inversion where an in-window update that isn't the
  // newest got called "Latest" while a newer, out-of-window update was called
  // "Previous". (updates is newest-first, so updates[0] is the latest.)
  const latestId = updates[0].id;
  const recencyLabel = (u) => (u.id === latestId ? 'Latest update' : 'Previous update');
  const topLabel = range ? 'Updated in this period' : 'Latest update';
  const canToggle = rest.length > 1;

  const HistoryToggle = () => (
    <button
      type="button"
      className="link-button history-toggle"
      aria-expanded={showHistory}
      onClick={() => setShowHistory((v) => !v)}
    >
      {showHistory ? 'Hide history ▲' : 'History ▾'}
    </button>
  );

  return (
    <div className="update-thread">
      {top.length > 0 && (
        <div className="update latest">
          <div className="update-top">
            <span className="update-label">{topLabel}</span>
            {canToggle && <HistoryToggle />}
          </div>
          {top.map((u, i) => (
            <div className={i > 0 ? 'update-entry divided' : 'update-entry'} key={u.id}>
              <div className="update-body">{u.body}</div>
              <div className="update-meta">
                <Avatar name={u.author_name} size={20} />
                <span className="update-author">{u.author_name ?? 'Unknown'}</span>
                <span className="update-dot" aria-hidden="true">
                  ·
                </span>
                <span className="update-date">{formatDate(u.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Collapsed: the most-recent non-highlighted entry, shown in full. When the
          task has no in-period update this is its latest update (plain style). */}
      {rest.length > 0 && !showHistory && (
        <div className="update previous">
          <div className="update-top">
            <span className="update-label">{recencyLabel(rest[0])}</span>
            {top.length === 0 && canToggle && <HistoryToggle />}
          </div>
          <div className="update-body">{rest[0].body}</div>
          <div className="update-meta">
            <span className="update-author">{rest[0].author_name ?? 'Unknown'}</span>
            <span className="update-dot" aria-hidden="true">
              ·
            </span>
            <span className="update-date">{formatDate(rest[0].created_at)}</span>
          </div>
        </div>
      )}

      {/* Expanded: the full set of non-highlighted updates, newest-first. */}
      {showHistory && (
        <div className="update-history">
          {rest.map((u) => (
            <div className="update previous" key={u.id}>
              <span className="update-label">{recencyLabel(u)}</span>
              <div className="update-body">{u.body}</div>
              <div className="update-meta">
                <span className="update-author">{u.author_name ?? 'Unknown'}</span>
                <span className="update-dot" aria-hidden="true">
                  ·
                </span>
                <span className="update-date">{formatDate(u.created_at)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
