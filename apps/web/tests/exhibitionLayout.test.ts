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
        'west-lake-map',
        'silk-and-tea',
        'west-lake-bicycle',
        'green-mobility-car',
        'west-lake-wall-art'
      ])
    );
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
