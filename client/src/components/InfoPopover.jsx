// Small "i" info icon that reveals a longer text description in a popover.
// Shown next to milestone/task names only when a description exists, so empty
// ones cost no space. The popover opens on hover (desktop), click/tap (mobile),
// and keyboard focus, and closes on Escape or outside click — so the content is
// reachable everywhere, unlike a hover-only tooltip. Long text wraps and scrolls.

import { useEffect, useRef, useState } from 'react';

export default function InfoPopover({ text, label = 'description' }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    }
    function onKey(e) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!text) return null;

  return (
    <span
      className="info-popover"
      ref={wrapRef}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-trigger"
        aria-label={`Show ${label}`}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-5M12 8h.01" />
        </svg>
      </button>
      {open && (
        <span className="info-bubble" role="tooltip">
          {text}
        </span>
      )}
    </span>
  );
}
