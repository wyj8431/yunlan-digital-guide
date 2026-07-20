export type AppRoute = 'guide' | 'lip-sync-lab';

export function resolveAppRoute(pathname: string): AppRoute {
  return pathname === '/lab/lip-sync' ? 'lip-sync-lab' : 'guide';
}
