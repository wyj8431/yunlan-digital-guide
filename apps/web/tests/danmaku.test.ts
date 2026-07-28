import { describe, expect, it } from 'vitest';
import { getVisibleDanmaku } from '../src/video/danmaku';
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

describe('getVisibleDanmaku', () => {
  it('returns only the messages active at the video clock position', () => {
    expect(getVisibleDanmaku(danmaku, 6_000)).toEqual([danmaku[0]]);
  });

  it('recalculates the active layer after seeking', () => {
    expect(getVisibleDanmaku(danmaku, 14_000)).toEqual([danmaku[1]]);
  });

  it('limits visible scrolling messages by the selected density', () => {
    expect(
      getVisibleDanmaku([...danmaku, { ...danmaku[0], id: 3, timestampMs: 5_200 }], 6_000, 1)
    ).toHaveLength(1);
  });
});
