import { describe, expect, it } from 'vitest';
import {
  PLAYER_RADIUS,
  ROOM_BOUNDS,
  canMoveTo,
  clampToRoom,
  type Collider
} from '../src/exhibition/collision';

describe('exhibition collision helpers', () => {
  it('clamps the player center inside the room with radius clearance', () => {
    expect(clampToRoom({ x: 12, z: 0 }, ROOM_BOUNDS, PLAYER_RADIUS)).toEqual({
      x: 7.6,
      z: 0
    });
    expect(clampToRoom({ x: -20, z: 20 }, ROOM_BOUNDS, PLAYER_RADIUS)).toEqual({
      x: -7.6,
      z: 9.6
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
});
