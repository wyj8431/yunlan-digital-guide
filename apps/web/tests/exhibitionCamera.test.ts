import { describe, expect, it } from 'vitest';
import { CAMERA_FOCUS_DISTANCE, CAMERA_FOCUS_HEIGHT, getExhibitFocusTarget, getZoneFocusTarget, HOME_CAMERA_POSITION, ZONE_FOCUS_DISTANCE } from '../src/exhibition/cameraFocus';

describe('exhibition camera focus', () => {
  it('starts from the stable home camera position', () => {
    expect(HOME_CAMERA_POSITION).toEqual([0, 1.65, 12.5]);
  });

  it('places the camera outside an exhibit and aims at its visual center', () => {
    const target = getExhibitFocusTarget({ position: [4, 1.2, 0], targetHeight: 2 });

    expect(target.target).toEqual([4, 1.2 + 2 * CAMERA_FOCUS_HEIGHT, 0]);
    expect(target.position[0]).toBeCloseTo(4 + CAMERA_FOCUS_DISTANCE);
    expect(target.position[2]).toBe(0);
    expect(target.position[1]).toBeCloseTo(target.target[1] + 0.58);
  });

  it('uses a forward fallback for an exhibit at the hall center', () => {
    const target = getExhibitFocusTarget({ position: [0, 1, 0], targetHeight: 1 });

    expect(target.position[0]).toBe(0);
    expect(target.position[2]).toBeCloseTo(CAMERA_FOCUS_DISTANCE);
  });

  it('frames a zone portal from the visitor path', () => {
    const target = getZoneFocusTarget({ position: [-3.2, 0, -8.7] });

    expect(target.target).toEqual([-3.2, 1.35, -8.7]);
    expect(target.position).toEqual([-3.2, 1.95, -8.7 + ZONE_FOCUS_DISTANCE]);
  });
});
