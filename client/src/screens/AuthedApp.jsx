// The authenticated app's tiny router. No URL router in v1 yet (see decisions.md)
// — navigation is in-memory route state: the project list, a project detail, or
// the admin area. A single navigate() is threaded to the screens.

import { useState } from 'react';
import { PeriodProvider } from '../period/PeriodContext.jsx';
import ProjectList from './ProjectList.jsx';
import ProjectDetail from './ProjectDetail.jsx';
import AdminUsers from './AdminUsers.jsx';
import AdminMappings from './AdminMappings.jsx';

export default function AuthedApp() {
  const [route, setRoute] = useState({ name: 'list' });

  const onAdmin = () => setRoute({ name: 'admin', tab: 'users' });

  // PeriodProvider sits above the screens so the review-period selection persists
  // across navigation (switching projects must not reset it).
  let screen;
  if (route.name === 'admin') {
    screen =
      route.tab === 'mappings' ? (
        <AdminMappings onNavigate={setRoute} focusUserId={route.focusUserId} />
      ) : (
        <AdminUsers onNavigate={setRoute} />
      );
  } else if (route.name === 'detail') {
    screen = (
      <ProjectDetail
        key={route.id}
        projectId={route.id}
        initialMode={route.mode ?? 'view'}
        onNavigate={setRoute}
        onAdmin={onAdmin}
      />
    );
  } else {
    screen = (
      <ProjectList
        onOpen={(id) => setRoute({ name: 'detail', id })}
        onEdit={(id) => setRoute({ name: 'detail', id, mode: 'edit' })}
        onAdmin={onAdmin}
      />
    );
  }

  return <PeriodProvider>{screen}</PeriodProvider>;
}
