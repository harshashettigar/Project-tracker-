// Shared formatting helpers and the canonical status vocabulary (PRD §7.2).

// Initials for an avatar — first + last word, or first two letters of one word.
export function initials(name = '') {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Dates display as dd/mm/yyyy (PRD §20.4). Input is an ISO 'YYYY-MM-DD' string.
// A derived/absent target date shows "— Not set" per §12.2 / §19.2.
export function formatDate(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.slice(0, 10).split('-');
  if (!y || !m || !d) return iso;
  return `${d}/${m}/${y}`;
}

// Status enum → display label + chip class. Labels and colour meaning are fixed
// across projects/milestones/tasks (PRD §7.2). One source of truth.
export const STATUSES = [
  { value: 'draft', label: 'Draft' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'on_hold', label: 'On hold' },
  { value: 'completed', label: 'Completed' },
  { value: 'at_risk', label: 'At risk' },
];

const STATUS_LABEL = Object.fromEntries(STATUSES.map((s) => [s.value, s.label]));

export function statusLabel(value) {
  return STATUS_LABEL[value] ?? value;
}
