export type Point2 = { x: number; z: number };

export type Collider = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export const ROOM_BOUNDS: Collider = {
  minX: -8,
  maxX: 8,
  minZ: -10,
  maxZ: 10
};

export const PLAYER_RADIUS = 0.4;

export function clampToRoom(point: Point2, bounds: Collider, radius: number): Point2 {
  return {
    x: Math.min(bounds.maxX - radius, Math.max(bounds.minX + radius, point.x)),
    z: Math.min(bounds.maxZ - radius, Math.max(bounds.minZ + radius, point.z))
  };
}

export function canMoveTo(
  point: Point2,
  delta: Point2,
  colliders: Collider[],
  radius: number
): boolean {
  const candidate = { x: point.x + delta.x, z: point.z + delta.z };

  return !colliders.some(
    (collider) =>
      candidate.x + radius > collider.minX &&
      candidate.x - radius < collider.maxX &&
      candidate.z + radius > collider.minZ &&
      candidate.z - radius < collider.maxZ
  );
}
