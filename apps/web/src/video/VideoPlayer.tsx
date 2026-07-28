import { Captions, MessageSquareText } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { Danmaku, VideoDetail } from '../types/video';
import { getDanmakuProgress, getVisibleDanmaku } from './danmaku';
import type { DanmakuPreferences } from './danmakuPreferences';
import {
  canUseLiveSubtitleRecognition,
  resolveSubtitleDisplay,
  type LiveSubtitleState
} from './subtitleFallback';

type PlaybackState = 'paused' | 'playing' | 'buffering' | 'seeking' | 'ended';

type VideoPlayerProps = {
  video: VideoDetail;
  danmaku: Danmaku[];
  preferences: DanmakuPreferences;
  onClockChange: (currentMs: number) => void;
};

export function VideoPlayer({ video, danmaku, preferences, onClockChange }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('paused');
  const liveSubtitleState = useMemo<LiveSubtitleState>(
    () => (canUseLiveSubtitleRecognition() ? { status: 'idle' } : { status: 'unsupported' }),
    []
  );

  useEffect(() => {
    setCurrentMs(0);
    setPlaybackState('paused');
  }, [video.id]);

  const syncClock = useCallback(
    (element: HTMLVideoElement) => {
      const nextMs = Math.round(element.currentTime * 1_000);
      setCurrentMs(nextMs);
      onClockChange(nextMs);
    },
    [onClockChange]
  );

  useEffect(() => {
    if (playbackState !== 'playing' || typeof requestAnimationFrame !== 'function') return;
    let frameId = 0;
    const tick = () => {
      if (videoRef.current) syncClock(videoRef.current);
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [playbackState, syncClock]);

  const subtitle = useMemo(
    () => resolveSubtitleDisplay(video.subtitleCues, currentMs, liveSubtitleState),
    [currentMs, liveSubtitleState, video.subtitleCues]
  );
  const visibleDanmaku = useMemo(
    () => getVisibleDanmaku(danmaku, currentMs, preferences.density, preferences.speed),
    [currentMs, danmaku, preferences.density, preferences.speed]
  );
  const layerStyle = {
    '--danmaku-size': `${preferences.fontSize}px`,
    '--danmaku-opacity': String(preferences.opacity)
  } as CSSProperties;
  const paused = playbackState !== 'playing';

  function freeze(element: HTMLVideoElement, state: PlaybackState) {
    syncClock(element);
    setPlaybackState(state);
  }

  return (
    <section className="video-player" aria-label={`${video.title}播放区`}>
      <div className="video-player-media">
        <video
          ref={videoRef}
          key={video.id}
          aria-label={`${video.title}播放器`}
          controls
          poster={video.coverUrl}
          preload="metadata"
          src={video.videoUrl}
          onPlaying={(event) => {
            syncClock(event.currentTarget);
            setPlaybackState('playing');
          }}
          onPause={(event) => freeze(event.currentTarget, 'paused')}
          onWaiting={(event) => freeze(event.currentTarget, 'buffering')}
          onStalled={(event) => freeze(event.currentTarget, 'buffering')}
          onSeeking={(event) => freeze(event.currentTarget, 'seeking')}
          onSeeked={(event) => {
            syncClock(event.currentTarget);
            setPlaybackState(event.currentTarget.paused ? 'paused' : 'playing');
          }}
          onEnded={(event) => freeze(event.currentTarget, 'ended')}
          onTimeUpdate={(event) => syncClock(event.currentTarget)}
        />
        <div
          aria-hidden="true"
          className={`video-danmaku-layer${paused ? ' is-paused' : ''}`}
          style={layerStyle}
        >
          {visibleDanmaku.map((item, index) => {
            const progress = getDanmakuProgress(item, currentMs, preferences.speed);
            const positionStyle: CSSProperties =
              item.position === 'scroll'
                ? {
                    left: `${(1 - progress) * 100}%`,
                    transform: `translateX(${-progress * 100}%)`
                  }
                : {};
            const itemStyle: CSSProperties & { '--danmaku-row': string } = {
              ...positionStyle,
              color: item.color,
              '--danmaku-row': String(index % preferences.density)
            };
            return (
              <span
                key={item.id}
                className={`video-danmaku-item video-danmaku-item--${item.position}`}
                style={itemStyle}
              >
                {item.content}
              </span>
            );
          })}
        </div>
        <div className="video-subtitle" aria-live="polite" aria-atomic="true">
          <Captions aria-hidden="true" size={15} />
          <span>{subtitle.text}</span>
        </div>
      </div>
      <div className="video-player-title">
        <MessageSquareText aria-hidden="true" size={16} />
        <span>视频时间轴驱动字幕与弹幕</span>
      </div>
    </section>
  );
}
