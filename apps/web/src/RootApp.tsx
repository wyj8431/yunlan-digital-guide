// 根级路由组件，根据当前地址切换主页、展馆、视频中心和实验室。
import { useCallback, useEffect, useState } from 'react';
import { App } from './App';
import { ExhibitionPage } from './components/ExhibitionPage';
import { BuildingVRPage } from './components/BuildingVRPage';
import { VideoCenterPage } from './components/VideoCenterPage';
import { LipSyncLab } from './lab/lip-sync/LipSyncLab';
import { JavaWorkOrdersPage } from './components/JavaWorkOrdersPage';
import {
  pathForTourismView,
  pathForScenicVR,
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

  const openScenic = useCallback((spotId: string) => {
    const pathname = pathForScenicVR(spotId);

    if (window.location.pathname !== pathname) {
      window.history.pushState({}, '', pathname);
    }

    setRoute({ kind: 'scenic-vr', spotId });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, []);

  if (route.kind === 'lip-sync-lab') {
    return <LipSyncLab />;
  }

  if (route.kind === 'java-work-orders') {
    return <JavaWorkOrdersPage />;
  }

  if (route.kind === 'exhibition') {
    return (
      <ExhibitionPage
        onReturnHome={() => navigate('explore')}
        onOpenGuide={() => navigate('explore')}
      />
    );
  }

  if (route.kind === 'videos') {
    return <VideoCenterPage onReturnHome={() => navigate('explore')} />;
  }

  if (route.kind === 'scenic-vr') {
    return <BuildingVRPage spotId={route.spotId} onReturnMap={() => navigate('map')} />;
  }

  return <App activeView={route.view} onNavigate={navigate} onOpenScenic={openScenic} />;
}
