import type { Danmaku } from '../types/video';

export const DANMAKU_LIFETIME_MS = 7_000;

export function getDanmakuLifetimeMs(speed = 1): number {
  return DANMAKU_LIFETIME_MS / Math.max(0.5, speed);
}

export function getDanmakuProgress(item: Danmaku, currentMs: number, speed = 1): number {
  const elapsed = currentMs - item.timestampMs;
  return Math.min(1, Math.max(0, elapsed / getDanmakuLifetimeMs(speed)));
}

export function getVisibleDanmaku(
  danmaku: Danmaku[],
  currentMs: number,
  density = Number.POSITIVE_INFINITY,
  speed = 1
): Danmaku[] {
  const active = danmaku.filter(
    (item) => getDanmakuProgress(item, currentMs, speed) < 1 && item.timestampMs <= currentMs
  );
  const visible: Danmaku[] = [];
  const scrolling = new Set<number>();

  for (const item of active) {
    if (item.position !== 'scroll' || scrolling.size < density) {
      visible.push(item);
      if (item.position === 'scroll') scrolling.add(item.id);
    }
  }

  return visible;
}
