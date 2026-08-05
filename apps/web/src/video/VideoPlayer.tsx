import { Captions, MessageSquareText, Mic, MicOff } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import YouTube, { type YouTubePlayer } from 'react-youtube';
import type { CreateDanmakuInput, Danmaku, VideoDetail } from '../types/video';
import { getDanmakuProgress, getVisibleDanmaku } from './danmaku';
import type { DanmakuPreferences } from './danmakuPreferences';
import {
  canUseLiveSubtitleRecognition,
  createLiveSubtitleRecognition,
  disposeLiveSubtitleRecognition,
  readRecognitionTranscript,
  resolveSubtitleDisplay,
  type LiveSubtitleState
} from './subtitleFallback';
import './liveSubtitle.css';

type PlaybackState = 'paused' | 'playing' | 'buffering' | 'seeking' | 'ended';

type VideoPlayerProps = {
  video: VideoDetail;
  danmaku: Danmaku[];
  preferences: DanmakuPreferences;
  onClockChange: (currentMs: number) => void;
  danmakuPreview?: Pick<CreateDanmakuInput, 'content' | 'position' | 'color'> | null;
};

export function VideoPlayer({
  video,
  danmaku,
  preferences,
  onClockChange,
  danmakuPreview
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const youtubePlayerRef = useRef<YouTubePlayer | null>(null);
  const [currentMs, setCurrentMs] = useState(0);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('paused');
  const recognitionSupported = useMemo(() => canUseLiveSubtitleRecognition(), []);
  const [recognitionEnabled, setRecognitionEnabled] = useState(false);
  const [liveSubtitleState, setLiveSubtitleState] = useState<LiveSubtitleState>(() =>
    recognitionSupported ? { status: 'idle' } : { status: 'unsupported' }
  );

  useEffect(() => {
    setCurrentMs(0);
    setPlaybackState('paused');
  }, [video.id]);

  useEffect(() => {
    if (!recognitionEnabled) {
      setLiveSubtitleState(recognitionSupported ? { status: 'idle' } : { status: 'unsupported' });
      return;
    }

    const recognition = createLiveSubtitleRecognition();
    if (!recognition) {
      setLiveSubtitleState({ status: 'unsupported' });
      return;
    }

    let disposed = false;
    // 实时识别是增强能力；失败时状态会交给字幕解析器降级到预置字幕。
    setLiveSubtitleState({ status: 'listening' });
    recognition.onresult = (event) => {
      if (disposed) return;
      const transcript = readRecognitionTranscript(event);
      setLiveSubtitleState(transcript ? { status: 'ready', transcript } : { status: 'listening' });
    };
    recognition.onerror = () => {
      if (!disposed) setLiveSubtitleState({ status: 'failed' });
    };
    recognition.onend = () => {
      if (!disposed) {
        setLiveSubtitleState((current) =>
          current.status === 'failed' ? current : { status: 'idle' }
        );
      }
    };

    try {
      recognition.start();
    } catch {
      setLiveSubtitleState({ status: 'failed' });
    }

    return () => {
      // 切换视频、关闭识别或卸载组件时都必须释放浏览器的麦克风识别会话。
      disposed = true;
      disposeLiveSubtitleRecognition(recognition);
    };
  }, [recognitionEnabled, recognitionSupported, video.id]);

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
    // 只在视频实际播放时逐帧同步，暂停和缓冲期间保持字幕、弹幕位置不动。
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
  const youtubeVideoId = useMemo(() => {
    try {
      const url = new URL(video.videoUrl);
      if (url.hostname.includes('youtu.be')) return url.pathname.slice(1);
      if (url.hostname.includes('youtube.com')) return url.searchParams.get('v');
    } catch {
      return null;
    }
    return null;
  }, [video.videoUrl]);

  const syncYouTubeClock = useCallback(async () => {
    const seconds = await youtubePlayerRef.current?.getCurrentTime();
    if (typeof seconds !== 'number') return;
    const nextMs = Math.round(seconds * 1_000);
    setCurrentMs(nextMs);
    onClockChange(nextMs);
  }, [onClockChange]);

  useEffect(() => {
    if (!youtubeVideoId || playbackState !== 'playing') return;
    const timer = window.setInterval(() => void syncYouTubeClock(), 250);
    return () => window.clearInterval(timer);
  }, [playbackState, syncYouTubeClock, youtubeVideoId]);

  function freeze(element: HTMLVideoElement, state: PlaybackState) {
    syncClock(element);
    setPlaybackState(state);
  }

  return (
    <section className="video-player" aria-label={`${video.title}播放区`}>
      <div className="video-player-media">
        {youtubeVideoId ? (
          <YouTube
            key={video.id}
            videoId={youtubeVideoId}
            className="video-youtube-player"
            iframeClassName="video-youtube-frame"
            title={`${video.title}播放器`}
            opts={{ width: '100%', height: '100%', playerVars: { rel: 0, playsinline: 1 } }}
            onReady={(event) => {
              youtubePlayerRef.current = event.target;
            }}
            onPlay={() => setPlaybackState('playing')}
            onPause={() => {
              void syncYouTubeClock();
              setPlaybackState('paused');
            }}
            onEnd={() => {
              void syncYouTubeClock();
              setPlaybackState('ended');
            }}
          />
        ) : (
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
        )}
        <div
          aria-hidden="true"
          className={`video-danmaku-layer${paused ? ' is-paused' : ''}`}
          style={layerStyle}
        >
          {visibleDanmaku.map((item, index) => {
            // 弹幕位置由视频时间轴直接计算，拖动进度条后也能立即落到正确位置。
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
          {danmakuPreview ? (
            <span
              className={`video-danmaku-item video-danmaku-item--${danmakuPreview.position} video-danmaku-item--preview`}
              style={{ color: danmakuPreview.color }}
            >
              {danmakuPreview.content}
            </span>
          ) : null}
        </div>
        <div className="video-subtitle" aria-live="polite" aria-atomic="true">
          <Captions aria-hidden="true" size={15} />
          <span>{subtitle.text}</span>
        </div>
      </div>
      <div className="video-player-title">
        <MessageSquareText aria-hidden="true" size={16} />
        <span>视频时间轴驱动字幕与弹幕</span>
        {recognitionSupported ? (
          <button
            className={`video-live-subtitle-toggle${recognitionEnabled ? ' is-enabled' : ''}`}
            type="button"
            aria-label={recognitionEnabled ? '关闭实时字幕' : '启用实时字幕'}
            aria-pressed={recognitionEnabled}
            title={recognitionEnabled ? '关闭实时字幕' : '启用实时字幕'}
            onClick={() => setRecognitionEnabled((enabled) => !enabled)}
          >
            {recognitionEnabled ? (
              <Mic aria-hidden="true" size={15} />
            ) : (
              <MicOff aria-hidden="true" size={15} />
            )}
          </button>
        ) : null}
      </div>
    </section>
  );
}
