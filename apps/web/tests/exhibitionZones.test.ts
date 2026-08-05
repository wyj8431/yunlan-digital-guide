import { describe, expect, it } from 'vitest';
import { HALL_BOUNDS } from '../src/exhibition/collision';
import { HALL_ZONES } from '../src/exhibition/zones';

describe('exhibition zone structure', () => {
  it('defines the entrance and four linked exhibition zones in order', () => {
    expect(HALL_ZONES.map((zone) => zone.id)).toEqual([
      'entrance',
      'history',
      'architecture',
      'heritage',
      'future'
    ]);
  });

  it('keeps zone portals inside the hall footprint', () => {
    for (const zone of HALL_ZONES) {
      expect(zone.position[0]).toBeGreaterThanOrEqual(HALL_BOUNDS.minX);
      expect(zone.position[0]).toBeLessThanOrEqual(HALL_BOUNDS.maxX);
      expect(zone.position[2]).toBeGreaterThanOrEqual(HALL_BOUNDS.minZ);
      expect(zone.position[2]).toBeLessThanOrEqual(HALL_BOUNDS.maxZ);
    }
  });

  it('spaces the four rear portals evenly against the back wall', () => {
    expect(HALL_ZONES.slice(1).map((zone) => zone.position[0])).toEqual([-11.25, -3.75, 3.75, 11.25]);
    expect(new Set(HALL_ZONES.slice(1).map((zone) => zone.position[2]))).toEqual(new Set([-17.6]));
  });

});
