// Status chip (PRD §7.2): a coloured dot + label. Status always renders as a
// chip, never plain text, and colour is never the sole carrier of meaning — the
// label is always present (PRD §20.4). Colour comes from the per-status CSS class.

import { statusLabel } from '../lib/format.js';

export default function StatusChip({ status }) {
  return (
    <span className={`chip status-${status}`}>
      <span className="chip-dot" aria-hidden="true" />
      {statusLabel(status)}
    </span>
  );
}
