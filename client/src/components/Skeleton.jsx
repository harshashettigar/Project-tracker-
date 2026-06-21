// Skeleton placeholders shown only on a COLD load (no cached data yet). They
// mirror the real layout's shape so the eye registers structure immediately,
// which reads as faster than a spinner or "Loading…" text. Revisits skip these
// entirely — cached content renders straight away (see useCachedQuery).

// A single shimmering bar. `w` accepts any CSS width (e.g. '60%', '120px').
export function SkeletonBar({ w = '100%', h = 14 }) {
  return <span className="skeleton skeleton-bar" style={{ width: w, height: h }} />;
}

// Project-list table shape: a header row plus several body rows.
export function ListSkeleton({ rows = 6 }) {
  return (
    <table className="project-table project-list-table skeleton-table" aria-hidden="true">
      <thead>
        <tr>
          <th className="num">Sl</th>
          <th>Project Name</th>
          <th>Start Date</th>
          <th>Target Date</th>
          <th>Status</th>
          <th>Responsible</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, i) => (
          <tr key={i}>
            <td className="num">
              <SkeletonBar w="18px" />
            </td>
            <td>
              <SkeletonBar w="70%" />
            </td>
            <td>
              <SkeletonBar w="64px" />
            </td>
            <td>
              <SkeletonBar w="64px" />
            </td>
            <td>
              <SkeletonBar w="80px" h={20} />
            </td>
            <td>
              <SkeletonBar w="55%" />
            </td>
            <td />
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Project-detail shape: summary card + a couple of milestone blocks.
export function DetailSkeleton() {
  return (
    <div aria-hidden="true">
      <section className="summary-band">
        <SkeletonBar w="240px" h={26} />
        <div className="summary-facts" style={{ marginTop: '1rem' }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div className="fact" key={i}>
              <SkeletonBar w="54px" h={10} />
              <SkeletonBar w="90px" />
            </div>
          ))}
        </div>
      </section>
      {Array.from({ length: 2 }).map((_, i) => (
        <section className="milestone-block" key={i}>
          <header className="milestone-header">
            <SkeletonBar w="180px" h={18} />
          </header>
          <div style={{ padding: '0.75rem 0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <SkeletonBar w="100%" />
            <SkeletonBar w="92%" />
            <SkeletonBar w="80%" />
          </div>
        </section>
      ))}
    </div>
  );
}
