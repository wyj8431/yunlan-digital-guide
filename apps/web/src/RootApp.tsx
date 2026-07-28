import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import { ExhibitionPage } from './components/ExhibitionPage';
import { VideoCenterPage } from './components/VideoCenterPage';
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

  if (route.kind === 'lip-sync-lab') {
    return <LipSyncLab />;
  }

  if (route.kind === 'exhibition') {
    return <ExhibitionPage onReturnHome={() => navigate('explore')} />;
  }

  if (route.kind === 'videos') {
    return <VideoCenterPage onReturnHome={() => navigate('explore')} />;
  }

  return <App activeView={route.view} onNavigate={navigate} />;
}
