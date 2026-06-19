// One sub-project row, shared by the View list (ProjectDetail) and the Edit
// list (SubProjectsEditor) so both render identically: folder icon, name, owner
// sub-line and a status chip. The whole row opens the child in View; an optional
// trailing ✕ (Edit only) unlinks it.

import StatusChip from './StatusChip.jsx';

function FolderGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 7v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-7l-2-2H5a2 2 0 0 0-2 2z" />
    </svg>
  );
}

export default function SubProjectRow({ sub, onOpen, onUnlink, busy }) {
  return (
    <li className="subproject-row">
      <button type="button" className="subproject-open" onClick={onOpen}>
        <span className="subproject-icon" aria-hidden="true">
          <FolderGlyph />
        </span>
        <span className="subproject-meta">
          <span className="subproject-name">{sub.name}</span>
          {sub.owner_name && <span className="subproject-owner">{sub.owner_name}</span>}
        </span>
        <StatusChip status={sub.status} />
      </button>
      {onUnlink && (
        <button
          type="button"
          className="file-remove"
          title="Unlink"
          disabled={busy}
          onClick={onUnlink}
        >
          ✕
        </button>
      )}
    </li>
  );
}
