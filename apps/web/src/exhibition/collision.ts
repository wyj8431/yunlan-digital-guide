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
export const MAX_FRAME_DELTA_SECONDS = 0.1;

export function clampFrameDelta(delta: number): number {
  return Math.min(MAX_FRAME_DELTA_SECONDS, Math.max(0, delta));
}

export function normalizeMovement(delta: Point2): Point2 {
  const length = Math.hypot(delta.x, delta.z);
  return length > 1 ? { x: delta.x / length, z: delta.z / length } : delta;
}

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

  // 将玩家半径扩展到展品包围盒上，边缘刚好接触时仍允许移动。
  return !colliders.some(
    (collider) =>
      candidate.x + radius > collider.minX &&
      candidate.x - radius < collider.maxX &&
      candidate.z + radius > collider.minZ &&
      candidate.z - radius < collider.maxZ
  );
}

export function resolveMovement(
  point: Point2,
  delta: Point2,
  colliders: Collider[],
  bounds: Collider,
  radius: number
): Point2 {
  const target = clampToRoom({ x: point.x + delta.x, z: point.z + delta.z }, bounds, radius);
  if (canMoveTo(target, { x: 0, z: 0 }, colliders, radius)) {
    return target;
  }

  const xOnly = clampToRoom({ x: target.x, z: point.z }, bounds, radius);
  if (canMoveTo(xOnly, { x: 0, z: 0 }, colliders, radius)) {
    return xOnly;
  }

  const zOnly = clampToRoom({ x: point.x, z: target.z }, bounds, radius);
  if (canMoveTo(zOnly, { x: 0, z: 0 }, colliders, radius)) {
    return zOnly;
  }

  return point;
}
