// Review-period selector for the top bar: All · This week · Custom date.
// Drives how task updates are highlighted in the detail view (see PeriodContext).
// Global + sticky — the selection persists across screens and refresh.

import { useEffect, useRef, useState } from 'react';
import { usePeriod } from '../period/PeriodContext.jsx';
import { formatDate } from '../lib/format.js';

export default function PeriodControl() {
  const { period, setPeriod } = usePeriod();
  const [open, setOpen] = useState(false); // custom-range popover
  const [from, setFrom] = useState(period.mode === 'custom' ? period.from : '');
  const [to, setTo] = useState(period.mode === 'custom' ? period.to : '');
  const wrapRef = useRef(null);

  const mode = period.mode;

  // Close the custom popover on outside click / Escape.
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

  function applyCustom() {
    if (!from || !to || from > to) return;
    setPeriod({ mode: 'custom', from, to });
    setOpen(false);
  }

  const customLabel =
    mode === 'custom' && period.from && period.to
      ? `${formatDate(period.from)} – ${formatDate(period.to)}`
      : 'Custom date';

  return (
    <div className="period-control" ref={wrapRef}>
      <div className="period-seg" role="group" aria-label="Review period">
        <button
          type="button"
          className={`period-tab ${mode === 'all' ? 'active' : ''}`}
          aria-pressed={mode === 'all'}
          onClick={() => {
            setPeriod({ mode: 'all' });
            setOpen(false);
          }}
        >
          All
        </button>
        <button
          type="button"
          className={`period-tab ${mode === 'week' ? 'active' : ''}`}
          aria-pressed={mode === 'week'}
          onClick={() => {
            setPeriod({ mode: 'week' });
            setOpen(false);
          }}
        >
          This week
        </button>
        <button
          type="button"
          className={`period-tab ${mode === 'custom' ? 'active' : ''}`}
          aria-pressed={mode === 'custom'}
          aria-expanded={open}
          onClick={() => {
            setFrom(period.mode === 'custom' ? period.from : from);
            setTo(period.mode === 'custom' ? period.to : to);
            setOpen((v) => !v);
          }}
        >
          {customLabel}
        </button>
      </div>

      {open && (
        <div className="period-popover" role="dialog" aria-label="Custom date range">
          <label className="period-field">
            <span>From</span>
            <input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="period-field">
            <span>To</span>
            <input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
          </label>
          <div className="period-popover-actions">
            <button type="button" className="link-button" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="button"
              className="primary-button small"
              disabled={!from || !to || from > to}
              onClick={applyCustom}
            >
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
