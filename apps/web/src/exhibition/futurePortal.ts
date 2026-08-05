import type { Collider, Point2 } from './collision';

export type ExhibitionSceneId = 'hall' | 'history' | 'future';

export const FUTURE_WUZHEN_BOUNDS: Collider = {
  minX: -16.2,
  maxX: 16.2,
  minZ: -16.2,
  maxZ: 18.4
};

export const FUTURE_PORTAL_ENTRY = {
  minX: 9.1,
  maxX: 13.4,
  maxZ: -16.7
} as const;

export const HISTORY_PORTAL_ENTRY = {
  minX: -13.4,
  maxX: -9.1,
  maxZ: -16.7
} as const;

export const HISTORY_RETURN_PORTAL = {
  minX: -2.8,
  maxX: 2.8,
  minZ: -15.55
} as const;

export const FUTURE_RETURN_PORTAL = {
  minX: -2.8,
  maxX: 2.8,
  minZ: 17.25
} as const;

export function isFuturePortalEntry(point: Point2): boolean {
  return point.x >= FUTURE_PORTAL_ENTRY.minX
    && point.x <= FUTURE_PORTAL_ENTRY.maxX
    && point.z <= FUTURE_PORTAL_ENTRY.maxZ;
}

export function isHistoryPortalEntry(point: Point2): boolean {
  return point.x >= HISTORY_PORTAL_ENTRY.minX
    && point.x <= HISTORY_PORTAL_ENTRY.maxX
    && point.z <= HISTORY_PORTAL_ENTRY.maxZ;
}

export function isFutureReturnPortalEntry(point: Point2): boolean {
  return point.x >= FUTURE_RETURN_PORTAL.minX
    && point.x <= FUTURE_RETURN_PORTAL.maxX
    && point.z >= FUTURE_RETURN_PORTAL.minZ;
}

export function isHistoryReturnPortalEntry(point: Point2): boolean {
  return point.x >= HISTORY_RETURN_PORTAL.minX
    && point.x <= HISTORY_RETURN_PORTAL.maxX
    && point.z <= HISTORY_RETURN_PORTAL.minZ;
}
