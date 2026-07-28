import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getDanmakuLifetimeMs, getDanmakuProgress, getVisibleDanmaku } from '../src/video/danmaku';
import type { Danmaku } from '../src/types/video';

const danmaku: Danmaku[] = [
  {
    id: 1,
    videoId: 'west-lake-dawn',
    content: '清晨的湖面真安静',
    timestampMs: 5_000,
    position: 'scroll',
    color: '#ffffff',
    nickname: '游客 0001',
    createdAt: '2026-07-28T00:00:00.000Z'
  },
  {
    id: 2,
    videoId: 'west-lake-dawn',
    content: '远处的山很好看',
    timestampMs: 13_000,
    position: 'top',
    color: '#f5d76e',
    nickname: '游客 0002',
    createdAt: '2026-07-28T00:00:00.000Z'
  }
];

describe('danmaku video-clock synchronization', () => {
  it('derives deterministic progress from the video clock', () => {
    expect(getDanmakuProgress(danmaku[0], 5_000, 1)).toBe(0);
    expect(getDanmakuProgress(danmaku[0], 8_500, 1)).toBe(0.5);
    expect(getDanmakuProgress(danmaku[0], 12_000, 1)).toBe(1);
  });

  it('uses the same speed-adjusted lifetime for visibility and progress', () => {
    expect(getDanmakuLifetimeMs(2)).toBe(3_500);
    expect(getVisibleDanmaku(danmaku, 8_499, 3, 2)).toEqual([danmaku[0]]);
    expect(getVisibleDanmaku(danmaku, 8_500, 3, 2)).toEqual([]);
  });

  it('recalculates the active layer after seeking', () => {
    expect(getVisibleDanmaku(danmaku, 14_000)).toEqual([danmaku[1]]);
  });

  it('limits visible scrolling messages by the selected density', () => {
    expect(
      getVisibleDanmaku([...danmaku, { ...danmaku[0], id: 3, timestampMs: 5_200 }], 6_000, 1)
    ).toHaveLength(1);
  });

  it('presents scrolling messages statically when reduced motion is requested', () => {
    const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
    expect(styles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.video-danmaku-item--scroll[\s\S]*transform:\s*translateX\(-50%\)\s*!important/
    );
  });
});
