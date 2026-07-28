import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DigitalHumanStage, getTimelineMouthOpen } from '../src/components/DigitalHumanStage';
import type { GuideSpeechTimeline } from '../src/types/guide';

const testState = vi.hoisted(() => ({
  rendererOptions: [] as Array<Record<string, unknown>>,
  setPixelRatio: vi.fn(),
  rendererDispose: vi.fn(),
  disposeObject3D: vi.fn(),
  rafCallbacks: [] as FrameRequestCallback[],
  visibilityListeners: [] as Array<(event: Event) => void>
}));

vi.mock('../src/lib/three/disposeObject3D', () => ({
  disposeObject3D: testState.disposeObject3D
}));

vi.mock('three', () => {
  const noop = () => {};

  class NodeLike {
    position = { set: noop, x: 0, y: 0, z: 0 };
    rotation = { set: noop, x: 0, y: 0, z: 0 };
    scale = { set: noop, setScalar: noop, x: 1, y: 1, z: 1 };
    add() {}
    lookAt() {}
    traverse(callback: (item: unknown) => void) {
      callback(this);
    }
  }

  return {
    Scene: class extends NodeLike {
      background = null;
    },
    PerspectiveCamera: class extends NodeLike {
      aspect = 1;
      updateProjectionMatrix() {}
    },
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      shadowMap = { enabled: false, type: 0 };

      constructor(options: Record<string, unknown>) {
        testState.rendererOptions.push(options);
      }

      setPixelRatio = testState.setPixelRatio;

      setSize() {}

      render() {}

      dispose = testState.rendererDispose;
    },
    HemisphereLight: class extends NodeLike {},
    DirectionalLight: class extends NodeLike {
      castShadow = false;
    },
    AmbientLight: class extends NodeLike {},
    Mesh: class extends NodeLike {
      receiveShadow = false;
      castShadow = false;

      constructor(
        public readonly geometry: unknown,
        public readonly material: unknown
      ) {
        super();
      }
    },
    CircleGeometry: class {},
    CylinderGeometry: class {},
    RingGeometry: class {},
    TorusGeometry: class {},
    MeshStandardMaterial: class {
      constructor(public readonly options: unknown) {}
    },
    MeshBasicMaterial: class {
      constructor(public readonly options: unknown) {}
    },
    Clock: class {
      getDelta() {
        return 0.016;
      }

      getElapsedTime() {
        return 0;
      }
    },
    AnimationMixer: class {
      clipAction() {
        return { play: noop };
      }

      update() {}

      stopAllAction() {}
    },
    Box3: class {
      min = { x: 0, y: 0, z: 0 };

      setFromObject() {
        return this;
      }

      getCenter(target: { x: number; y: number; z: number }) {
        target.x = 0;
        target.y = 1;
        target.z = 0;
        return target;
      }

      getSize(target: { x: number; y: number; z: number }) {
        target.x = 1;
        target.y = 2;
        target.z = 1;
        return target;
      }
    },
    Vector3: class {
      x = 0;
      y = 0;
      z = 0;
    },
    PCFSoftShadowMap: 1,
    DoubleSide: 2
  };
});

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(_url: string, onLoad: (gltf: unknown) => void) {
      onLoad({
        scene: {
          position: { set: vi.fn(), x: 0, y: 0, z: 0 },
          rotation: { set: vi.fn(), x: 0, y: 0, z: 0 },
          scale: { setScalar: vi.fn(), x: 1, y: 1, z: 1 },
          traverse: vi.fn(),
          add: vi.fn()
        },
        animations: []
      });
    }
  }
}));

describe('DigitalHumanStage', () => {
  let hidden = false;

  function setHidden(nextHidden: boolean) {
    hidden = nextHidden;
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden
    });
  }

  function flushFrame() {
    const callback = testState.rafCallbacks.shift();
    expect(callback).toBeDefined();
    callback?.(16);
  }

  beforeEach(() => {
    setHidden(false);
    testState.rendererOptions.length = 0;
    testState.rafCallbacks.length = 0;
    testState.visibilityListeners.length = 0;
    testState.setPixelRatio.mockClear();
    testState.rendererDispose.mockClear();
    testState.disposeObject3D.mockClear();

    class TestResizeObserver {
      observe() {}
      disconnect() {}
    }

    Object.defineProperty(globalThis, 'ResizeObserver', {
      configurable: true,
      value: TestResizeObserver
    });

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          enabled: false,
          provider: 'three-fallback',
          reason: '测试环境使用本地 3D 数字人'
        })
      })
    );

    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      testState.rafCallbacks.push(callback);
      return testState.rafCallbacks.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
    vi.spyOn(document, 'addEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') {
        testState.visibilityListeners.push(listener as (event: Event) => void);
      }
    });
    vi.spyOn(document, 'removeEventListener').mockImplementation((type, listener) => {
      if (type === 'visibilitychange') {
        testState.visibilityListeners = testState.visibilityListeners.filter(
          (current) => current !== listener
        );
      }
    });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('uses the optimized production renderer and disposes scene resources', () => {
    const { unmount } = render(<DigitalHumanStage speaking={false} />);

    expect(testState.rendererOptions[0]).toMatchObject({ antialias: true, alpha: true });
    expect(testState.rendererOptions[0]).not.toHaveProperty('preserveDrawingBuffer');
    expect(testState.setPixelRatio).toHaveBeenCalledWith(expect.any(Number));
    expect(document.querySelector('canvas')).toBeInTheDocument();

    unmount();

    expect(testState.disposeObject3D).toHaveBeenCalled();
    expect(testState.rendererDispose).toHaveBeenCalled();
  });

  it('presents the refined young guide identity while idle', async () => {
    render(<DigitalHumanStage speaking={false} />);

    expect(screen.getByLabelText('乌镇景区年轻数字导游舞台')).toBeInTheDocument();
    expect(await screen.findByText('3D 数字人模型')).toBeInTheDocument();
    expect(await screen.findByText('测试环境使用本地 3D 数字人')).toBeInTheDocument();
    expect(screen.getByText('年轻导游')).toBeInTheDocument();
    expect(screen.getByText('乌镇景区')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '介绍' })).toBeInTheDocument();
    expect(document.querySelector('canvas')).toBeInTheDocument();
  });

  it('announces narration state while speaking', () => {
    render(<DigitalHumanStage speaking />);

    expect(screen.getByText('正在讲解乌镇景区')).toBeInTheDocument();
  });

  it('reads mouth openness from a speech timeline cue', () => {
    const timeline: GuideSpeechTimeline = {
      text: '你好',
      durationMs: 900,
      source: 'estimated',
      visemes: [
        { startMs: 0, endMs: 200, viseme: 'aa', mouthOpen: 0.8 },
        { startMs: 200, endMs: 320, viseme: 'mouth-closed', mouthOpen: 0 }
      ]
    };

    expect(getTimelineMouthOpen(timeline, 100)).toBeGreaterThan(0.4);
    expect(getTimelineMouthOpen(timeline, 260)).toBe(0);
    expect(getTimelineMouthOpen(timeline, 1100)).toBe(0);
  });

  it('pauses the frame loop while hidden and resumes on visibility change', () => {
    render(<DigitalHumanStage speaking={false} />);

    expect(testState.visibilityListeners).toHaveLength(1);
    expect(testState.rafCallbacks).toHaveLength(1);

    setHidden(true);
    flushFrame();

    expect(testState.rafCallbacks).toHaveLength(0);

    setHidden(false);
    testState.visibilityListeners[0]?.(new Event('visibilitychange'));

    expect(testState.rafCallbacks).toHaveLength(1);
  });
});
