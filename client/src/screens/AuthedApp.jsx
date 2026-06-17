// The authenticated app's tiny router. No URL router in v1 yet (see decisions.md)
// — navigation is in-memory route state: the project list or a project detail.
// A single navigate() is threaded to the screens that move between them.

import { useState } from 'react';
import ProjectList from './ProjectList.jsx';
import ProjectDetail from './ProjectDetail.jsx';

export default function AuthedApp() {
  const [route, setRoute] = useState({ name: 'list' });

  if (route.name === 'detail') {
    return <ProjectDetail projectId={route.id} onNavigate={setRoute} />;
  }
  return <ProjectList onOpen={(id) => setRoute({ name: 'detail', id })} />;
}
