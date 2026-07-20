import { App } from './App';
import { LipSyncLab } from './lab/lip-sync/LipSyncLab';
import { resolveAppRoute } from './routing/appRoute';

export function RootApp() {
  const route = resolveAppRoute(window.location.pathname);

  return route === 'lip-sync-lab' ? <LipSyncLab /> : <App />;
}
