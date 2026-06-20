// Priority chip (post-v1 extension): a coloured dot + label, mirroring StatusChip.
// Colour never carries meaning alone — the label (Low/Mid/High) is always shown.

import { priorityLabel } from '../lib/format.js';

export default function PriorityChip({ priority }) {
  return (
    <span className={`chip priority-${priority}`}>
      <span className="chip-dot" aria-hidden="true" />
      {priorityLabel(priority)}
    </span>
  );
}
