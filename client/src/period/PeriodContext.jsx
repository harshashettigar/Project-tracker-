// Review-period state (PRD-adjacent, post-v1). A single app-wide "period" drives
// how task updates are highlighted in the detail view, for weekly-review meetings:
//   - all    → no window (today's behaviour: just the latest update highlighted)
//   - week   → Monday 00:00 (local) → now
//   - custom → an explicit from→to range (for catching up after skipped meetings)
//
// The selection is GLOBAL and STICKY: it lives above the screens (so switching
// projects doesn't reset it) and is persisted to localStorage (so a refresh keeps
// it). `all` is the reset. This is a pure view concern — no server/DB involvement.

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'pt.reviewPeriod';
const ONLY_KEY = 'pt.onlyUpdated';
const DEFAULT = { mode: 'all' };

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && (p.mode === 'all' || p.mode === 'week' || p.mode === 'custom')) return p;
    }
  } catch {
    /* ignore malformed storage */
  }
  return DEFAULT;
}

function loadOnlyUpdated() {
  try {
    return localStorage.getItem(ONLY_KEY) === '1';
  } catch {
    return false;
  }
}

// Monday 00:00 (local) of the week containing `now`.
function startOfWeekMonday(now) {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
  d.setDate(d.getDate() - dow);
  return d;
}

// Resolve a period into a concrete { start, end } Date range, or null for "all"
// / an incomplete custom range (null = don't window anything).
export function computeRange(period, now = new Date()) {
  if (!period || period.mode === 'all') return null;
  if (period.mode === 'week') return { start: startOfWeekMonday(now), end: now };
  if (period.mode === 'custom') {
    if (!period.from || !period.to) return null;
    const start = new Date(`${period.from}T00:00:00`);
    const end = new Date(`${period.to}T23:59:59.999`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return null;
    return { start, end };
  }
  return null;
}

// Is an ISO timestamp inside the range? false when there's no range.
export function inRange(iso, range) {
  if (!range || !iso) return false;
  const t = new Date(iso).getTime();
  return t >= range.start.getTime() && t <= range.end.getTime();
}

const PeriodContext = createContext(null);

export function PeriodProvider({ children }) {
  const [period, setPeriod] = useState(load);
  // "Show only updated" is part of the review period: global + sticky, so the
  // top-bar switch works the same way (and persists) across the whole product.
  const [onlyUpdated, setOnlyUpdated] = useState(loadOnlyUpdated);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(period));
    } catch {
      /* storage may be unavailable; non-fatal */
    }
  }, [period]);

  useEffect(() => {
    try {
      localStorage.setItem(ONLY_KEY, onlyUpdated ? '1' : '0');
    } catch {
      /* non-fatal */
    }
  }, [onlyUpdated]);

  const range = useMemo(() => computeRange(period), [period]);

  // The switch is meaningless without a window: drop it when the period is "All".
  useEffect(() => {
    if (!range && onlyUpdated) setOnlyUpdated(false);
  }, [range, onlyUpdated]);

  const value = useMemo(
    () => ({ period, setPeriod, range, onlyUpdated, setOnlyUpdated }),
    [period, range, onlyUpdated],
  );
  return <PeriodContext.Provider value={value}>{children}</PeriodContext.Provider>;
}

export function usePeriod() {
  return (
    useContext(PeriodContext) ?? {
      period: DEFAULT,
      setPeriod: () => {},
      range: null,
      onlyUpdated: false,
      setOnlyUpdated: () => {},
    }
  );
}
