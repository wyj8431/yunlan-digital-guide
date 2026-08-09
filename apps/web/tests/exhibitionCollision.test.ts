import { describe, expect, it } from 'vitest';
import {
  PLAYER_RADIUS,
  ROOM_BOUNDS,
  canMoveTo,
  clampFrameDelta,
  clampToRoom,
  normalizeMovement,
  resolveMovement,
  type Collider
} from '../src/exhibition/collision';

describe('exhibition collision helpers', () => {
  it('clamps the player center inside the room with radius clearance', () => {
    expect(clampToRoom({ x: 30, z: 0 }, ROOM_BOUNDS, PLAYER_RADIUS)).toEqual({
      x: ROOM_BOUNDS.maxX - PLAYER_RADIUS,
      z: 0
    });
    expect(clampToRoom({ x: -30, z: 70 }, ROOM_BOUNDS, PLAYER_RADIUS)).toEqual({
      x: ROOM_BOUNDS.minX + PLAYER_RADIUS,
      z: ROOM_BOUNDS.maxZ - PLAYER_RADIUS
    });
  });

  it('rejects movement when the player radius overlaps an exhibit', () => {
    const colliders: Collider[] = [{ minX: 0.5, maxX: 1.5, minZ: -1, maxZ: 1 }];

    expect(canMoveTo({ x: 0, z: 0 }, { x: 1, z: 0 }, colliders, PLAYER_RADIUS)).toBe(false);
  });

  it('allows touching an exhibit edge and movement along an unblocked axis', () => {
    const colliders: Collider[] = [{ minX: 0.5, maxX: 1.5, minZ: -1, maxZ: 1 }];

    expect(canMoveTo({ x: 0, z: 1.4 }, { x: 0.1, z: 0 }, colliders, PLAYER_RADIUS)).toBe(true);
    expect(canMoveTo({ x: 0, z: 0 }, { x: 0, z: 1.5 }, colliders, PLAYER_RADIUS)).toBe(true);
  });

  it('caps long or invalid frame deltas before movement is calculated', () => {
    expect(clampFrameDelta(0.4)).toBe(0.1);
    expect(clampFrameDelta(-0.2)).toBe(0);
  });

  it('normalizes diagonal input without slowing a single axis', () => {
    const diagonal = normalizeMovement({ x: 1, z: 1 });
    expect(diagonal.x).toBeCloseTo(Math.SQRT1_2);
    expect(diagonal.z).toBeCloseTo(Math.SQRT1_2);
    expect(normalizeMovement({ x: 0.5, z: 0 })).toEqual({ x: 0.5, z: 0 });
  });

  it('moves diagonally when the target is clear', () => {
    expect(resolveMovement({ x: 0, z: 0 }, { x: 1, z: 1 }, [], ROOM_BOUNDS, PLAYER_RADIUS)).toEqual(
      {
        x: 1,
        z: 1
      }
    );
  });

  it('slides along the clear axis when diagonal movement hits an exhibit', () => {
    const blockX: Collider = { minX: 0.5, maxX: 1.5, minZ: -0.5, maxZ: 1.5 };

    expect(
      resolveMovement({ x: 0, z: 0 }, { x: 1, z: 1 }, [blockX], ROOM_BOUNDS, PLAYER_RADIUS)
    ).toEqual({ x: 0, z: 1 });
  });
});
