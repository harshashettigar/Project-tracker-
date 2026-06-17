// The authenticated app's tiny router. No URL router in v1 yet (see decisions.md)
// — navigation is in-memory route state: the project list, a project detail, or
// the admin area. A single navigate() is threaded to the screens.

import { useState } from 'react';
import ProjectList from './ProjectList.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import AdminUsers from './AdminUsers.jsx';

export default function AuthedApp() {
  const [route, setRoute] = useState({ name: 'list' });

  const onAdmin = () => setRoute({ name: 'admin' });

  if (route.name === 'admin') {
    return <AdminUsers onNavigate={setRoute} />;
  }
  if (route.name === 'detail') {
    return (
      <ProjectDetail
        key={route.id}
        projectId={route.id}
        initialMode={route.mode ?? 'view'}
        onNavigate={setRoute}
        onAdmin={onAdmin}
      />
    );
  }
  return (
    <ProjectList
      onOpen={(id) => setRoute({ name: 'detail', id })}
      onEdit={(id) => setRoute({ name: 'detail', id, mode: 'edit' })}
      onAdmin={onAdmin}
    />
  );
}
