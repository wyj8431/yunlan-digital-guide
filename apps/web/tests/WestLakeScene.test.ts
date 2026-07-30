import { describe, expect, it, vi } from 'vitest';

vi.mock('three', async (importOriginal) => {
  const THREE = await importOriginal<typeof import('three')>();
  return {
    ...THREE,
    AudioListener: class extends THREE.Object3D {}
  };
});
import { PLAYER_RADIUS } from '../src/exhibition/collision';
import { LAKE_BOUNDS, resolveLakeMovement } from '../src/exhibition/westLakeScene';

describe('West Lake scene movement', () => {
  it('keeps movement inside the landscape bounds with player clearance', () => {
    const next = resolveLakeMovement({ x: 0, z: 6 }, { x: 40, z: 40 });
    expect(next.x).toBeLessThanOrEqual(LAKE_BOUNDS.maxX - PLAYER_RADIUS);
    expect(next.z).toBeLessThanOrEqual(LAKE_BOUNDS.maxZ - PLAYER_RADIUS);
  });

  it('keeps the lake water blocked while the causeway remains walkable', () => {
    expect(resolveLakeMovement({ x: 0, z: 6 }, { x: 4, z: -4 }).z).toBe(6);
    expect(resolveLakeMovement({ x: 0, z: 6 }, { x: 0, z: -1 }).z).toBe(5);
  });

  it('blocks bridge rails, pagoda base, and major shoreline trees', () => {
    expect(resolveLakeMovement({ x: 0, z: 1.8 }, { x: 0.8, z: -0.5 })).toEqual({ x: 0, z: 1.3 });
    expect(resolveLakeMovement({ x: 5.7, z: -2.8 }, { x: 0, z: -1.4 })).toEqual({
      x: 5.7,
      z: -2.8
    });
    expect(resolveLakeMovement({ x: -2.4, z: 5.8 }, { x: -0.8, z: 0 })).toEqual({
      x: -2.4,
      z: 5.8
    });
  });
});
