// Small initials avatar used beside an owner's name (PRD §9.3).

import { initials } from '../lib/format.js';

export default function Avatar({ name, size = 24 }) {
  return (
    <span
      className="owner-avatar"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}
