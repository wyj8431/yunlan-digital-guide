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
  setFreeRoam: vi.fn(),
  setWeather: vi.fn(),
  goToZone: vi.fn(),
  goToExhibit: vi.fn(() => true),
  rotateModel: vi.fn(() => true),
  resetModel: vi.fn(() => true),
  moveByInput: vi.fn(),
  rotateByInput: vi.fn(),
  setFocus: vi.fn(),
  setTransitionProgress: vi.fn(),
  playNarration: vi.fn(),
  stopNarration: vi.fn(),
  startModelInteraction: vi.fn(() => true),
  stopModelInteraction: vi.fn(),
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
    setFreeRoam = rendererState.setFreeRoam;
    setWeather = rendererState.setWeather;
    goToZone = rendererState.goToZone;
    goToExhibit = rendererState.goToExhibit;
    rotateModel = rendererState.rotateModel;
    resetModel = rendererState.resetModel;
    moveByInput = rendererState.moveByInput;
    rotateByInput = rendererState.rotateByInput;
    setFocus = rendererState.setFocus;
    setTransitionProgress = rendererState.setTransitionProgress;
    playNarration = rendererState.playNarration;
    stopNarration = rendererState.stopNarration;
    startModelInteraction = rendererState.startModelInteraction;
    stopModelInteraction = rendererState.stopModelInteraction;
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
    setFreeRoam = rendererState.setFreeRoam;
    setWeather = rendererState.setWeather;
    moveByInput = rendererState.moveByInput;
    rotateByInput = rendererState.rotateByInput;
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

  it('locks the exhibition to high quality and provides an ambient audio control', async () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    expect(rendererState.setQuality).toHaveBeenCalledWith('high');
    expect(screen.queryByRole('button', { name: /画质/ })).not.toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '开启环境声音' }));
    });
    expect(rendererState.unlockAudio).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '静音环境声音' }));
    expect(rendererState.setMuted).toHaveBeenCalledWith(true);
  });

  it('exposes visitor information, atmosphere choices, and free-roam controls', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    expect(rendererState.setWeather).toHaveBeenCalledWith('sunny');
    expect(rendererState.setFreeRoam).toHaveBeenCalledWith(true);

    fireEvent.click(screen.getByRole('button', { name: '打开景区地图和服务' }));
    expect(screen.getByRole('dialog', { name: '景区地图与游客服务' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '时间与服务' }));
    expect(screen.getByText('常规开放参考')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '场景氛围：晴天' }));
    fireEvent.click(screen.getByRole('button', { name: '雨景' }));
    expect(rendererState.setWeather).toHaveBeenLastCalledWith('rain');

    fireEvent.click(screen.getByRole('button', { name: '关闭自由漫游' }));
    expect(rendererState.setFreeRoam).toHaveBeenLastCalledWith(false);
  });

  it('keeps authored exhibit fallbacks unobtrusive for visitors', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    act(() => rendererState.hallCallbacks?.onRecoverableFailure?.('silk-garment'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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

  it('tracks exploration discoveries and provides a gallery quiz', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    fireEvent.click(screen.getByRole('button', { name: '打开展厅探索互动' }));
    expect(screen.getByRole('dialog', { name: '展厅探索互动' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: '互动展品发现进度' })).toHaveAttribute(
      'aria-valuenow',
      '0'
    );

    fireEvent.click(screen.getByRole('button', { name: '前往发现 水乡路线数字沙盘' }));
    expect(rendererState.goToExhibit).toHaveBeenCalledWith('west-lake-map');
    expect(screen.getByRole('dialog', { name: '乌镇路线数字沙盘' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '关闭展品介绍' }));
    fireEvent.click(screen.getByRole('button', { name: '打开展厅探索互动' }));
    expect(screen.getByRole('progressbar', { name: '互动展品发现进度' })).toHaveAttribute(
      'aria-valuenow',
      '1'
    );

    fireEvent.click(screen.getByRole('radio', { name: '水系' }));
    expect(screen.getByRole('status')).toHaveTextContent('回答正确');
  });

  it('runs model interactions from a supported exhibit detail panel', () => {
    render(<ExhibitionPage onReturnHome={vi.fn()} />);
    finishHallLoading();

    act(() => rendererState.selectExhibit?.('west-lake-bicycle'));

    fireEvent.click(screen.getByRole('button', { name: '模型环视' }));
    expect(rendererState.goToExhibit).toHaveBeenLastCalledWith('west-lake-bicycle');
    expect(rendererState.startModelInteraction).toHaveBeenLastCalledWith(
      'west-lake-bicycle',
      'orbit'
    );

    fireEvent.click(screen.getByRole('button', { name: '慢游演示' }));
    expect(rendererState.startModelInteraction).toHaveBeenLastCalledWith(
      'west-lake-bicycle',
      'animate'
    );

    fireEvent.change(screen.getByRole('slider', { name: '模型角度' }), {
      target: { value: '45' }
    });
    expect(rendererState.rotateModel).toHaveBeenLastCalledWith('west-lake-bicycle', 45);

    fireEvent.click(screen.getByRole('button', { name: '细节聚焦' }));
    expect(rendererState.startModelInteraction).toHaveBeenLastCalledWith(
      'west-lake-bicycle',
      'showcase'
    );

    fireEvent.click(screen.getByRole('button', { name: '复位模型' }));
    expect(rendererState.resetModel).toHaveBeenCalledWith('west-lake-bicycle');

    fireEvent.click(screen.getByRole('button', { name: '下一个互动模型' }));
    expect(rendererState.goToExhibit).toHaveBeenLastCalledWith('green-mobility-car');

    fireEvent.click(screen.getByRole('button', { name: '开始模型巡览' }));
    expect(screen.getByRole('button', { name: '暂停模型巡览' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: '暂停模型巡览' }));
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
    fireEvent.click(screen.getByRole('button', { name: '重新加载展馆' }));
    act(() => rendererState.hallCallbacks?.onReady?.());
    expect(screen.getByLabelText('乌镇室内 3D 展馆')).toHaveAttribute(
      'data-exhibition-ready',
      'true'
    );
    fireEvent.click(screen.getByRole('button', { name: '返回首页' }));
    fireEvent.click(screen.getByRole('button', { name: '数字人客服' }));
    expect(onReturnHome).toHaveBeenCalledTimes(2);
  });
});
