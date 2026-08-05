import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AssetProgress } from '../src/exhibition/assets/ExhibitionAssetLoader';
import type { QualityLevel } from '../src/exhibition/quality/qualityProfile';

type RendererCallbacks = {
  audio?: unknown;
  onProgress?: (progress: AssetProgress) => void;
  onReady?: () => void;
  onQualityChange?: (quality: QualityLevel) => void;
  onRecoverableFailure?: (message: string) => void;
  onFatalError?: (error: Error) => void;
};

const rendererState = vi.hoisted(() => ({
  hallDispose: vi.fn(),
  lakeDispose: vi.fn(),
  setInteractionEnabled: vi.fn(),
  unlockAudio: vi.fn(() => Promise.resolve()),
  setMuted: vi.fn(),
  setQuality: vi.fn(),
  setFocus: vi.fn(),
  setTransitionProgress: vi.fn(),
  playNarration: vi.fn(),
  stopNarration: vi.fn(),
  audioRuntimeDispose: vi.fn(),
  hallAudio: null as unknown,
  lakeAudio: null as unknown,
  selectExhibit: null as null | ((id: string) => void),
  hallCallbacks: null as null | RendererCallbacks,
  lakeCallbacks: null as null | RendererCallbacks
}));

vi.mock('../src/exhibition/audio/ExhibitionAudio', () => ({
  createExhibitionAudio: () => ({ dispose: rendererState.audioRuntimeDispose })
}));

vi.mock('../src/exhibition/ExhibitionRenderer', () => ({
  ExhibitionRenderer: class {
    constructor(
      options: RendererCallbacks & {
        host: HTMLElement;
        onExhibitSelect: (id: string) => void;
      }
    ) {
      options.host.appendChild(document.createElement('canvas'));
      rendererState.selectExhibit = options.onExhibitSelect;
      rendererState.hallCallbacks = options;
      rendererState.hallAudio = options.audio;
    }
    dispose = rendererState.hallDispose;
    setInteractionEnabled = rendererState.setInteractionEnabled;
    unlockAudio = rendererState.unlockAudio;
    setMuted = rendererState.setMuted;
    setQuality = rendererState.setQuality;
    setFocus = rendererState.setFocus;
    setTransitionProgress = rendererState.setTransitionProgress;
    playNarration = rendererState.playNarration;
    stopNarration = rendererState.stopNarration;
  }
}));

vi.mock('../src/exhibition/westLakeScene', () => ({
  WestLakeScene: class {
    constructor(options: RendererCallbacks & { host: HTMLElement }) {
      options.host.appendChild(document.createElement('canvas'));
      rendererState.lakeCallbacks = options;
      rendererState.lakeAudio = options.audio;
    }
    dispose = rendererState.lakeDispose;
    setInteractionEnabled = rendererState.setInteractionEnabled;
    unlockAudio = rendererState.unlockAudio;
    setMuted = rendererState.setMuted;
    setQuality = rendererState.setQuality;
    setFocus = rendererState.setFocus;
    setTransitionProgress = rendererState.setTransitionProgress;
  }
}));

import { ExhibitionPage } from '../src/components/ExhibitionPage';

function finishHallLoading() {
  act(() => {
    rendererState.hallCallbacks?.onProgress?.({
      loadedBytes: 100,
      totalBytes: 100,
      completed: 4,
      total: 4
    });
    rendererState.hallCallbacks?.onReady?.();
  });
}

describe('ExhibitionPage', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn()
      }))
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.clearAllMocks();
    rendererState.selectExhibit = null;
    rendererState.hallAudio = null;
    rendererState.lakeAudio = null;
    rendererState.hallCallbacks = null;
    rendererState.lakeCallbacks = null;
  });

  it('shows real loading progress and exposes the hall only after it is ready', () => {
    const { unmount } = render(<ExhibitionPage onReturnHome={vi.fn()} />);

    expect(screen.getByRole('progressbar', { name: '展馆资源加载进度' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );

    act(() =>
      rendererState.hallCallbacks?.onProgress?.({
        loadedBytes: 40,
        totalBytes: 100,
        completed: 2,
        total: 5
      })
    );
    expect(screen.getByRole('progressbar', { name: '展馆资源加载进度' })).toHaveAttribute(
      'aria-valuenow',
      '40'
    );

    finishHallLoading();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    expect(screen.getByLabelText('乌镇室内 3D 展馆')).toHaveAttribute(
      'data-exhibition-ready',
      'true'
    );

    unmount();
    expect(rendererState.hallDispose).toHaveBeenCalledTimes(1);
    expect(rendererState.audioRuntimeDispose).toHaveBeenCalledTimes(1);
  });

  it('provides compact audio and quality controls backed by renderer APIs', async () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '开启环境声音' }));
    });
    expect(rendererState.unlockAudio).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '静音环境声音' }));
    expect(rendererState.setMuted).toHaveBeenCalledWith(true);

    act(() => rendererState.hallCallbacks?.onQualityChange?.('high'));
    fireEvent.click(screen.getByRole('button', { name: '画质：高' }));
    expect(rendererState.setQuality).toHaveBeenCalledWith('medium');
  });

  it('focuses a selected exhibit, plays narration, and restores the hall on close', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    act(() => rendererState.selectExhibit?.('west-lake-bicycle'));

    expect(screen.getByRole('dialog', { name: '乌镇水乡慢游自行车' })).toBeInTheDocument();
    expect(rendererState.setFocus).toHaveBeenCalledWith('west-lake-bicycle');
    expect(rendererState.setInteractionEnabled).toHaveBeenLastCalledWith(false);

    fireEvent.click(screen.getByRole('button', { name: '播放语音讲解' }));
    expect(rendererState.playNarration).toHaveBeenCalledWith('west-lake-bicycle');

    fireEvent.click(screen.getByRole('button', { name: '关闭展品介绍' }));
    expect(rendererState.setFocus).toHaveBeenLastCalledWith(null);
    expect(rendererState.stopNarration).toHaveBeenCalledTimes(1);
    expect(rendererState.setInteractionEnabled).toHaveBeenLastCalledWith(true);
  });

  it('fades out, waits for the lake, fades in, and returns to the hall', () => {
    vi.useFakeTimers();
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();
    act(() => rendererState.selectExhibit?.('west-lake-map'));
    rendererState.setTransitionProgress.mockClear();

    fireEvent.click(screen.getByRole('button', { name: '进入乌镇沙盘' }));
    expect(screen.getByTestId('scene-transition')).toHaveAttribute('data-phase', 'fade-out');
    expect(rendererState.setInteractionEnabled).toHaveBeenLastCalledWith(false);
    expect(rendererState.setTransitionProgress).toHaveBeenCalledWith(0);

    act(() => vi.advanceTimersByTime(600));
    expect(rendererState.setTransitionProgress).toHaveBeenCalledWith(1);
    expect(screen.getByTestId('scene-transition')).toHaveAttribute('data-phase', 'switch');
    expect(rendererState.lakeCallbacks).not.toBeNull();
    expect(rendererState.lakeAudio).toBe(rendererState.hallAudio);

    rendererState.setTransitionProgress.mockClear();
    act(() => rendererState.lakeCallbacks?.onReady?.());
    expect(screen.getByTestId('scene-transition')).toHaveAttribute('data-phase', 'fade-in');
    expect(rendererState.setTransitionProgress).toHaveBeenCalledWith(1);
    act(() => vi.advanceTimersByTime(600));
    expect(rendererState.setTransitionProgress).toHaveBeenCalledWith(0);
    expect(screen.queryByTestId('scene-transition')).not.toBeInTheDocument();
    expect(screen.getByLabelText('乌镇 3D 实景')).toHaveAttribute('data-exhibition-ready', 'true');

    fireEvent.click(screen.getByRole('button', { name: '返回展馆' }));
    act(() => vi.advanceTimersByTime(600));
    act(() => rendererState.hallCallbacks?.onReady?.());
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByLabelText('乌镇室内 3D 展馆')).toBeInTheDocument();
  });

  it('recovers the previous scene when the target scene fails during a transition', () => {
    vi.useFakeTimers();
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();
    act(() => rendererState.selectExhibit?.('west-lake-map'));

    fireEvent.click(screen.getByRole('button', { name: '进入乌镇沙盘' }));
    act(() => vi.advanceTimersByTime(600));
    act(() => rendererState.lakeCallbacks?.onFatalError?.(new Error('WebGL context lost')));

    expect(screen.getByRole('alert')).toHaveTextContent('乌镇实景加载失败，已返回展馆');
    expect(screen.getByLabelText('乌镇室内 3D 展馆')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '返回首页' })).toBeEnabled();
  });

  it('keeps return and service actions available after a fatal hall error', () => {
    const onReturnHome = vi.fn();
    render(<ExhibitionPage onReturnHome={onReturnHome} />);
    act(() => rendererState.hallCallbacks?.onFatalError?.(new Error('WebGL unavailable')));

    expect(screen.getByRole('alert')).toHaveTextContent('3D 场景暂时无法加载');
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    fireEvent.click(screen.getByRole('button', { name: '数字人客服' }));
    expect(onReturnHome).toHaveBeenCalledTimes(2);
  });
});
