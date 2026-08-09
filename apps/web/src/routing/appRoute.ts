// 轻量路由解析器集中维护 URL 与页面视图之间的双向映射。
export type TourismView =
  | 'home'
  | 'guide'
  | 'explore'
  | 'itinerary'
  | 'profile'
  | 'history'
  | 'narration'
  | 'map'
  | 'voice';

export type AppRoute =
  | { kind: 'lip-sync-lab' }
  | { kind: 'tourism'; view: TourismView }
  | { kind: 'exhibition' }
  | { kind: 'videos' }
  | { kind: 'scenic-vr'; spotId: string };

const VIEW_PATHS: Record<TourismView, string> = {
  explore: '/',
  home: '/home',
  guide: '/guide',
  narration: '/narration',
  map: '/map',
  itinerary: '/itinerary',
  voice: '/voice',
  profile: '/profile',
  history: '/history'
};

const PATH_VIEWS = new Map(
  Object.entries(VIEW_PATHS).map(([view, pathname]) => [pathname, view as TourismView])
);

function normalizePathname(pathname: string) {
  if (pathname === '/') {
    return pathname;
  }

  return pathname.replace(/\/+$/, '') || '/';
}

export function resolveAppRoute(pathname: string): AppRoute {
  const normalizedPathname = normalizePathname(pathname);

  if (normalizedPathname === '/lab/lip-sync') {
    return { kind: 'lip-sync-lab' };
  }

  if (normalizedPathname === '/exhibition') {
    return { kind: 'exhibition' };
  }

  if (normalizedPathname === '/videos') {
    return { kind: 'videos' };
  }

  const scenicVrMatch = normalizedPathname.match(/^\/vr\/([^/]+)$/);
  if (scenicVrMatch) {
    return { kind: 'scenic-vr', spotId: decodeURIComponent(scenicVrMatch[1]) };
  }

  return {
    kind: 'tourism',
    view: PATH_VIEWS.get(normalizedPathname) ?? 'explore'
  };
}

export function pathForTourismView(view: TourismView) {
  return VIEW_PATHS[view];
}

export function pathForScenicVR(spotId: string) {
  return `/vr/${encodeURIComponent(spotId)}`;
}
