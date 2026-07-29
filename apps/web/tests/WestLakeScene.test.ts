import { describe, expect, it } from 'vitest';
import { PLAYER_RADIUS } from '../src/exhibition/collision';
import {
  LAKE_BOUNDS,
  createWestLakeModel,
  resolveLakeMovement
} from '../src/exhibition/westLakeScene';

describe('West Lake scene model', () => {
  it('builds every required named landmark group', () => {
    const model = createWestLakeModel();
    expect(model.children.map((child) => child.name)).toEqual(
      expect.arrayContaining([
        'lake-water',
        'su-causeway',
        'arch-bridge',
        'trees',
        'leifeng-pagoda',
        'distant-mountains'
      ])
    );
  });

  it('keeps movement inside the landscape bounds with player clearance', () => {
    const next = resolveLakeMovement({ x: 0, z: 6 }, { x: 40, z: 40 });
    expect(next.x).toBeLessThanOrEqual(LAKE_BOUNDS.maxX - PLAYER_RADIUS);
    expect(next.z).toBeLessThanOrEqual(LAKE_BOUNDS.maxZ - PLAYER_RADIUS);
  });

  it('keeps the lake water blocked while the causeway remains walkable', () => {
    expect(resolveLakeMovement({ x: 0, z: 6 }, { x: 4, z: -4 }).z).toBe(6);
    expect(resolveLakeMovement({ x: 0, z: 6 }, { x: 0, z: -1 }).z).toBe(5);
  });
});
