import { Captions, MessageSquareText } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Danmaku, VideoDetail } from '../types/video';
import { getVisibleDanmaku } from './danmaku';
import type { DanmakuPreferences } from './danmakuPreferences';

type VideoPlayerProps = {
  video: VideoDetail;
  danmaku: Danmaku[];
  preferences: DanmakuPreferences;
  onClockChange: (currentMs: number) => void;
};

export function VideoPlayer({ video, danmaku, preferences, onClockChange }: VideoPlayerProps) {
  const [currentMs, setCurrentMs] = useState(0);
  const [paused, setPaused] = useState(true);

  useEffect(() => {
    setCurrentMs(0);
    setPaused(true);
  }, [video.id]);

  const subtitle = useMemo(
    () => video.subtitleCues.find((cue) => cue.startMs <= currentMs && currentMs < cue.endMs),
    [currentMs, video.subtitleCues]
  );
  const visibleDanmaku = useMemo(
    () => getVisibleDanmaku(danmaku, currentMs, preferences.density),
    [currentMs, danmaku, preferences.density]
  );
  const layerStyle = {
    '--danmaku-speed': `${Math.max(3, 9 / preferences.speed)}s`,
    '--danmaku-size': `${preferences.fontSize}px`,
    '--danmaku-opacity': String(preferences.opacity)
  } as CSSProperties;

  function syncClock(element: HTMLVideoElement) {
    const nextMs = Math.round(element.currentTime * 1_000);
    setCurrentMs(nextMs);
    onClockChange(nextMs);
  }

  return (
    <section className="video-player" aria-label={`${video.title}播放区`}>
      <div className="video-player-media">
        <video
          key={video.id}
          aria-label={`${video.title}播放器`}
          controls
          poster={video.coverUrl}
          preload="metadata"
          src={video.videoUrl}
          onPlay={(event) => {
            setPaused(false);
            syncClock(event.currentTarget);
          }}
          onPause={(event) => {
            setPaused(true);
            syncClock(event.currentTarget);
          }}
          onTimeUpdate={(event) => syncClock(event.currentTarget)}
          onSeeked={(event) => syncClock(event.currentTarget)}
        />
        <div
          aria-label="弹幕层"
          className={`video-danmaku-layer${paused ? ' is-paused' : ''}`}
          style={layerStyle}
        >
          {visibleDanmaku.map((item, index) => (
            <span
              key={item.id}
              className={`video-danmaku-item video-danmaku-item--${item.position}`}
              style={
                {
                  color: item.color,
                  '--danmaku-row': String(index % preferences.density)
                } as CSSProperties
              }
            >
              {item.content}
            </span>
          ))}
        </div>
        <div className="video-subtitle" aria-live="polite">
          <Captions aria-hidden="true" size={15} />
          <span>{subtitle?.content ?? '预置字幕将在播放时同步显示'}</span>
        </div>
      </div>
      <div className="video-player-title">
        <MessageSquareText aria-hidden="true" size={16} />
        <span>视频时间轴驱动字幕与弹幕</span>
      </div>
    </section>
  );
}
