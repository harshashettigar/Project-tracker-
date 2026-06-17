// Admin area tab switch (PRD §16.1): Users and Mappings. Rendered at the top of
// each admin screen's body; navigation is the in-memory router.

export default function AdminTabs({ active, onNavigate }) {
  return (
    <div className="admin-tabs" role="tablist">
      <button
        type="button"
        role="tab"
        aria-selected={active === 'users'}
        className={`admin-tab ${active === 'users' ? 'active' : ''}`}
        onClick={() => onNavigate({ name: 'admin', tab: 'users' })}
      >
        Users
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={active === 'mappings'}
        className={`admin-tab ${active === 'mappings' ? 'active' : ''}`}
        onClick={() => onNavigate({ name: 'admin', tab: 'mappings' })}
      >
        Mappings
      </button>
    </div>
  );
}
