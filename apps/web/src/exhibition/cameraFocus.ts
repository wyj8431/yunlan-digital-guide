import type { HallExhibit } from './ThreeExhibition';
import type { HallZone } from './zones';

export const HOME_CAMERA_POSITION = [0, 1.65, 12.5] as const;
export const CAMERA_FOCUS_DISTANCE = 4.8;
export const CAMERA_FOCUS_HEIGHT = 0.45;
export const ZONE_FOCUS_DISTANCE = 5.5;

export type CameraFocusTarget = {
  position: [number, number, number];
  target: [number, number, number];
};

/**
 * Places the camera just outside an exhibit's radial footprint and aims at its visual center.
 * The radial approach keeps the camera away from the pedestal while preserving a consistent view.
 */
export function getExhibitFocusTarget(
  exhibit: Pick<HallExhibit, 'position' | 'targetHeight'>
): CameraFocusTarget {
  const [x, baseY, z] = exhibit.position;
  const distanceFromCenter = Math.hypot(x, z);
  const radialX = distanceFromCenter > 0.001 ? x / distanceFromCenter : 0;
  const radialZ = distanceFromCenter > 0.001 ? z / distanceFromCenter : 1;
  const targetY = baseY + exhibit.targetHeight * CAMERA_FOCUS_HEIGHT;

  return {
    position: [x + radialX * CAMERA_FOCUS_DISTANCE, targetY + 0.58, z + radialZ * CAMERA_FOCUS_DISTANCE],
    target: [x, targetY, z]
  };
}

/**
 * Frames a hall portal from the visitor path while keeping the portal readable.
 * The portals sit against the rear wall, so a forward offset works for both the
 * entrance and the linked exhibition rooms.
 */
export function getZoneFocusTarget(zone: Pick<HallZone, 'position'>): CameraFocusTarget {
  const [x, , z] = zone.position;
  const target: [number, number, number] = [x, 1.35, z];
  return {
    position: [x, 1.95, z + ZONE_FOCUS_DISTANCE],
    target
  };
}
