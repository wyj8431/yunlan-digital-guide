import { describe, expect, it } from 'vitest';
import {
  EXHIBITION_LAYOUT,
  HALL_DIMENSIONS,
  assertMainAisleClear
} from '../src/exhibition/exhibitionLayout';

describe('exhibition layout metadata', () => {
  it('defines the approved hall dimensions', () => {
    expect(HALL_DIMENSIONS).toEqual({ width: 16, depth: 20, height: 4.8 });
  });

  it('contains every major interactive exhibit', () => {
    expect(EXHIBITION_LAYOUT.map((item) => item.id)).toEqual(
      expect.arrayContaining([
        'silk-and-tea',
        'silk-garment',
        'west-lake-map',
        'west-lake-bicycle',
        'green-mobility-car',
        'west-lake-wall-art'
      ])
    );
  });

  it('keeps the West Lake sand table interactive, collidable, and outside the central aisle', () => {
    const sandTable = EXHIBITION_LAYOUT.find((item) => item.id === 'west-lake-map');
    expect(sandTable).toMatchObject({
      kind: 'sand-table',
      interactive: true,
      blocksMovement: true
    });
    expect(sandTable?.collider?.minX).toBeGreaterThanOrEqual(1.2);
  });

  it('gives every grounded obstacle a collider', () => {
    expect(
      EXHIBITION_LAYOUT.filter((item) => item.blocksMovement).every((item) => item.collider)
    ).toBe(true);
  });

  it('keeps the central 2.4 metre aisle clear', () => {
    expect(assertMainAisleClear(EXHIBITION_LAYOUT, 2.4)).toBe(true);
  });
});
