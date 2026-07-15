// Top-bar "Only updated" switch — sits beside the review-period selector and is
// universal across the product (like the date filter). It's part of the review
// period (PeriodContext): global + sticky. Disabled under period "All", where
// "updated in the period" has no meaning. Its EFFECT is applied by the screens
// that are period-aware (currently the project detail view) — matching how the
// date selector is present everywhere but acts on the detail.

import { usePeriod } from '../period/PeriodContext.jsx';

export default function OnlyUpdatedToggle() {
  const { range, onlyUpdated, setOnlyUpdated } = usePeriod();
  const active = !!range;

  return (
    <label
      className={`review-switch topbar-switch ${active ? '' : 'disabled'}`}
      title={
        active
          ? 'Show only tasks updated in the selected period'
          : 'Pick “This week” or a custom date range to enable'
      }
    >
      <input
        type="checkbox"
        role="switch"
        checked={onlyUpdated && active}
        disabled={!active}
        onChange={() => setOnlyUpdated((v) => !v)}
      />
      <span className="review-switch-track" aria-hidden="true">
        <span className="review-switch-knob" />
      </span>
      <span className="review-switch-label">Only updated</span>
    </label>
  );
}
