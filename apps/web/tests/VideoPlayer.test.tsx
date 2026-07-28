import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { VideoPlayer } from '../src/video/VideoPlayer';
import type { Danmaku, VideoDetail } from '../src/types/video';

const video: VideoDetail = {
  id: 'west-lake-dawn',
  title: '西湖晨光',
  description: '从湖畔出发的清晨漫游。',
  coverUrl: '/covers/west-lake-dawn.jpg',
  videoUrl: '/videos/west-lake-dawn.mp4',
  durationMs: 186_000,
  subtitleCues: [
    { id: 1, videoId: 'west-lake-dawn', startMs: 4_000, endMs: 8_000, content: '湖面泛起晨光。' }
  ]
};

const danmaku: Danmaku[] = [
  {
    id: 1,
    videoId: video.id,
    content: '好美',
    timestampMs: 5_000,
    position: 'scroll',
    color: '#ffffff',
    nickname: '游客 0001',
    createdAt: '2026-07-28T00:00:00.000Z'
  }
];

function setCurrentTime(element: HTMLVideoElement, seconds: number) {
  Object.defineProperty(element, 'currentTime', { configurable: true, value: seconds });
}

describe('VideoPlayer', () => {
  afterEach(() => cleanup());

  it('uses the video clock for synchronized subtitle and danmaku rendering', () => {
    render(
      <VideoPlayer
        video={video}
        danmaku={danmaku}
        preferences={{ speed: 1, fontSize: 18, opacity: 0.9, density: 3 }}
        onClockChange={() => undefined}
      />
    );
    const player = screen.getByLabelText('西湖晨光播放器') as HTMLVideoElement;

    setCurrentTime(player, 5);
    fireEvent.timeUpdate(player);

    expect(screen.getByText('湖面泛起晨光。')).toBeInTheDocument();
    expect(screen.getByText('好美')).toBeInTheDocument();
  });

  it('freezes the danmaku layer on pause and recalculates it on seeking', () => {
    render(
      <VideoPlayer
        video={video}
        danmaku={danmaku}
        preferences={{ speed: 1, fontSize: 18, opacity: 0.9, density: 3 }}
        onClockChange={() => undefined}
      />
    );
    const player = screen.getByLabelText('西湖晨光播放器') as HTMLVideoElement;
    const layer = screen.getByLabelText('弹幕层');

    fireEvent.pause(player);
    expect(layer).toHaveClass('is-paused');

    setCurrentTime(player, 12);
    fireEvent.seeked(player);
    expect(screen.queryByText('好美')).not.toBeInTheDocument();
  });
});
