import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LipSyncStage } from '../src/lab/lip-sync/components/LipSyncStage';

const rendererState = vi.hoisted(() => ({
  instances: [] as Array<{
    options: unknown;
    start: ReturnType<typeof vi.fn>;
    resize: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>
}));

vi.mock('../src/lab/lip-sync/three/LipSyncRenderer', () => ({
  LipSyncRenderer: vi.fn().mockImplementation((options: unknown) => {
    const instance = {
      options,
      start: vi.fn().mockResolvedValue(undefined),
      resize: vi.fn(),
      dispose: vi.fn()
    };
    rendererState.instances.push(instance);
    return instance;
  })
}));

describe('LipSyncStage', () => {
  let resizeCallback: ResizeObserverCallback;

  beforeEach(() => {
    rendererState.instances.length = 0;

    class TestResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        resizeCallback = callback;
      }

      observe() {}
      disconnect() {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates one renderer, resizes it, and disposes it on unmount', () => {
    const { unmount } = render(<LipSyncStage />);

    const host = screen.getByLabelText('本地 3D 数字人口型预览');
    expect(host).toBeInTheDocument();
    expect(rendererState.instances).toHaveLength(1);
    expect(rendererState.instances[0].start).toHaveBeenCalledTimes(1);

    resizeCallback([], {} as ResizeObserver);
    expect(rendererState.instances[0].resize).toHaveBeenCalledTimes(1);

    unmount();
    expect(rendererState.instances[0].dispose).toHaveBeenCalledTimes(1);
  });
});
