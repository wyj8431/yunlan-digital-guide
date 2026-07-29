import { describe, expect, it } from 'vitest';
import { EXHIBITION_LAYOUT, assertMainAisleClear } from '../src/exhibition/exhibitionLayout';
import { createHallMaterials } from '../src/exhibition/exhibitionMaterials';
import { createJiangnanHall } from '../src/exhibition/scene/createJiangnanHall';

describe('realistic Jiangnan hall', () => {
  it('builds the required full-scale architectural groups', () => {
    const hall = createJiangnanHall(createHallMaterials());
    expect(hall.children.map((child) => child.name)).toEqual(
      expect.arrayContaining([
        'architectural-shell',
        'moon-gate',
        'walnut-lattice',
        'stone-floor',
        'ceiling-tracks',
        'west-lake-scroll',
        'wayfinding',
        'fire-exit'
      ])
    );
    expect(hall.userData.dimensions).toEqual({ width: 16, depth: 20, height: 4.8 });
    expect(hall.userData.instancedLatticeCount).toBeGreaterThanOrEqual(24);
  });

  it('preserves the 2.4 metre central aisle', () => {
    expect(assertMainAisleClear(EXHIBITION_LAYOUT, 2.4)).toBe(true);
  });
});
