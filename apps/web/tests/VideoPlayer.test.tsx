import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { VideoPlayer } from '../src/video/VideoPlayer';
import {
  canUseLiveSubtitleRecognition,
  resolveSubtitleDisplay
} from '../src/video/subtitleFallback';
import type { CreateDanmakuInput, Danmaku, VideoDetail } from '../src/types/video';

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

class MockSpeechRecognition implements SpeechRecognition {
  static instances: MockSpeechRecognition[] = [];
  lang = '';
  continuous = false;
  interimResults = false;
  onresult: SpeechRecognition['onresult'] = null;
  onend: SpeechRecognition['onend'] = null;
  onerror: SpeechRecognition['onerror'] = null;
  onnomatch: SpeechRecognition['onnomatch'] = null;
  onspeechend: SpeechRecognition['onspeechend'] = null;
  onaudioend: SpeechRecognition['onaudioend'] = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  dispatchEvent = vi.fn(() => true);

  constructor() {
    MockSpeechRecognition.instances.push(this);
  }
}

function installSpeechRecognition() {
  MockSpeechRecognition.instances = [];
  window.SpeechRecognition = MockSpeechRecognition;
}

function setCurrentTime(element: HTMLVideoElement, seconds: number) {
  Object.defineProperty(element, 'currentTime', { configurable: true, value: seconds });
}

function renderPlayer() {
  const result = render(
    <VideoPlayer
      video={video}
      danmaku={danmaku}
      preferences={{ speed: 1, fontSize: 18, opacity: 0.9, density: 3 }}
      onClockChange={() => undefined}
    />
  );
  return {
    ...result,
    player: screen.getByLabelText('西湖晨光播放器') as HTMLVideoElement,
    layer: result.container.querySelector('.video-danmaku-layer') as HTMLElement
  };
}

function renderPlayerWithPreview(position: CreateDanmakuInput['position']) {
  return render(
    <VideoPlayer
      video={video}
      danmaku={danmaku}
      preferences={{ speed: 1, fontSize: 18, opacity: 0.9, density: 3 }}
      onClockChange={() => undefined}
      danmakuPreview={{ content: '新弹幕预览', position, color: '#f5d76e' }}
    />
  );
}

describe('VideoPlayer', () => {
  afterEach(() => {
    cleanup();
    delete window.SpeechRecognition;
    delete window.webkitSpeechRecognition;
    vi.restoreAllMocks();
  });

  it('positions danmaku deterministically from the video clock and resets after seeking', () => {
    const { player } = renderPlayer();
    setCurrentTime(player, 6);
    fireEvent.timeUpdate(player);

    const message = screen.getByText('好美');
    expect(Number.parseFloat(message.style.left)).toBeCloseTo((6 / 7) * 100);

    setCurrentTime(player, 10);
    fireEvent.seeking(player);
    fireEvent.seeked(player);
    expect(Number.parseFloat(screen.getByText('好美').style.left)).toBeCloseTo((2 / 7) * 100);
  });

  it('renders the new danmaku preview at the selected position', () => {
    const { rerender } = renderPlayerWithPreview('top');
    const preview = screen.getByText('新弹幕预览');
    expect(preview).toHaveClass('video-danmaku-item--top');

    rerender(
      <VideoPlayer
        video={video}
        danmaku={danmaku}
        preferences={{ speed: 1, fontSize: 18, opacity: 0.9, density: 3 }}
        onClockChange={() => undefined}
        danmakuPreview={{ content: '新弹幕预览', position: 'bottom', color: '#f5d76e' }}
      />
    );
    expect(screen.getByText('新弹幕预览')).toHaveClass('video-danmaku-item--bottom');
  });

  it('freezes on pause, waiting, stalled and seeking until playback resumes', () => {
    const { player, layer } = renderPlayer();

    fireEvent.playing(player);
    expect(layer).not.toHaveClass('is-paused');
    fireEvent.waiting(player);
    expect(layer).toHaveClass('is-paused');
    fireEvent.playing(player);
    fireEvent.stalled(player);
    expect(layer).toHaveClass('is-paused');
    fireEvent.playing(player);
    fireEvent.seeking(player);
    expect(layer).toHaveClass('is-paused');
    fireEvent.pause(player);
    expect(layer).toHaveClass('is-paused');
  });

  it('keeps danmaku out of the accessibility tree and localizes subtitle announcements', () => {
    const { player, layer, container } = renderPlayer();
    expect(layer).toHaveAttribute('aria-hidden', 'true');
    expect(container.querySelector('.video-player')).not.toHaveAttribute('aria-live');

    setCurrentTime(player, 5);
    fireEvent.timeUpdate(player);
    expect(screen.getByText('湖面泛起晨光。').closest('.video-subtitle')).toHaveAttribute(
      'aria-live',
      'polite'
    );
  });

  it('continues preset subtitles when live recognition is unsupported or fails', () => {
    expect(canUseLiveSubtitleRecognition({})).toBe(false);
    expect(resolveSubtitleDisplay(video.subtitleCues, 5_000, { status: 'unsupported' }).text).toBe(
      '湖面泛起晨光。'
    );
    expect(resolveSubtitleDisplay(video.subtitleCues, 5_000, { status: 'failed' }).text).toBe(
      '湖面泛起晨光。'
    );
  });

  it('retains preset subtitles and never pauses video when recognition errors', () => {
    installSpeechRecognition();
    const { player } = renderPlayer();
    const pauseSpy = vi.spyOn(player, 'pause');
    setCurrentTime(player, 5);
    fireEvent.timeUpdate(player);
    fireEvent.click(screen.getByRole('button', { name: '启用实时字幕' }));

    const recognition = MockSpeechRecognition.instances[0];
    expect(recognition).toMatchObject({ lang: 'zh-CN', continuous: true, interimResults: true });
    expect(recognition.start).toHaveBeenCalledTimes(1);

    act(() => recognition.onerror?.call(recognition, new Event('error')));

    expect(screen.getByText('湖面泛起晨光。')).toBeInTheDocument();
    expect(pauseSpy).not.toHaveBeenCalled();
  });

  it('shows recognition results and cleans up handlers when disabled', () => {
    installSpeechRecognition();
    renderPlayer();
    fireEvent.click(screen.getByRole('button', { name: '启用实时字幕' }));
    const recognition = MockSpeechRecognition.instances[0];

    act(() =>
      recognition.onresult?.call(recognition, {
        resultIndex: 0,
        results: {
          0: {
            0: { transcript: '现场识别字幕', confidence: 1 },
            isFinal: false,
            length: 1
          },
          length: 1
        }
      } as unknown as SpeechRecognitionEvent)
    );
    expect(screen.getByText('现场识别字幕')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭实时字幕' }));
    expect(recognition.stop).toHaveBeenCalledTimes(1);
    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(recognition.onresult).toBeNull();
    expect(recognition.onerror).toBeNull();
    expect(screen.getByText('预置字幕将在播放时同步显示')).toBeInTheDocument();
  });
});
