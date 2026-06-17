// Role chip (PRD §7.3): its own chip family, colours distinct from status so the
// two are never confused — Admin (violet), Manager (blue), Member (grey),
// Viewer (slate). User status (active/inactive) uses its own green/grey chip.

const ROLE_LABEL = { admin: 'Admin', manager: 'Manager', member: 'Member', viewer: 'Viewer' };

export function RoleChip({ role }) {
  return <span className={`chip role-${role}`}>{ROLE_LABEL[role] ?? role}</span>;
}

export function UserStatusChip({ status }) {
  return (
    <span className={`chip ustatus-${status}`}>
      <span className="chip-dot" aria-hidden="true" />
      {status === 'active' ? 'Active' : 'Inactive'}
    </span>
  );
}
