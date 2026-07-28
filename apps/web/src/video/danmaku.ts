import type { Danmaku } from '../types/video';

export const DANMAKU_LIFETIME_MS = 7_000;

export function getVisibleDanmaku(
  danmaku: Danmaku[],
  currentMs: number,
  density = Number.POSITIVE_INFINITY
): Danmaku[] {
  const active = danmaku.filter(
    (item) => item.timestampMs <= currentMs && currentMs < item.timestampMs + DANMAKU_LIFETIME_MS
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
