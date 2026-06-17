// Phase 0 shell. Just confirms the SPA builds and can reach the API.
// The login / list / detail / admin screens arrive in later phases.

import { useEffect, useState } from 'react';

export default function App() {
  const [health, setHealth] = useState('checking…');

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealth(d.ok ? 'API reachable' : 'API error'))
      .catch(() => setHealth('API unreachable'));
  }, []);

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', maxWidth: 640 }}>
      <h1>Project Tracker</h1>
      <p>Phase 0 scaffolding. Internal project, milestone &amp; task tracker.</p>
      <p>
        API status: <strong>{health}</strong>
      </p>
    </main>
  );
}
