import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import { LipSyncLab } from './lab/lip-sync/LipSyncLab';
import {
  pathForTourismView,
  resolveAppRoute,
  type AppRoute,
  type TourismView
} from './routing/appRoute';

export function RootApp() {
  const [route, setRoute] = useState<AppRoute>(() => resolveAppRoute(window.location.pathname));

  useEffect(() => {
    const handlePopState = () => {
      setRoute(resolveAppRoute(window.location.pathname));
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = useCallback((view: TourismView) => {
    const pathname = pathForTourismView(view);

    if (window.location.pathname !== pathname) {
      window.history.pushState({}, '', pathname);
    }

    setRoute({ kind: 'tourism', view });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  return route.kind === 'lip-sync-lab' ? (
    <LipSyncLab />
  ) : (
    <App activeView={route.view} onNavigate={navigate} />
  );
}
