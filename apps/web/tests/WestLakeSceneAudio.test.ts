import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  assetIds: [] as string[],
  assetLoad: vi.fn(),
  assetLoadAudio: vi.fn(),
  assetDispose: vi.fn(),
  audioUnlock: vi.fn().mockResolvedValue(undefined),
  audioSetScene: vi.fn(),
  audioSetBuffers: vi.fn(),
  audioSetWaterPosition: vi.fn(),
  audioAttachTo: vi.fn(),
  audioDetachFrom: vi.fn(),
  audioUpdateTravelledDistance: vi.fn(),
  audioSetMuted: vi.fn(),
  audioDispose: vi.fn(),
  environmentUpdate: vi.fn(),
  environmentDispose: vi.fn(),
  animationFrames: new Map<number, FrameRequestCallback>(),
  nextFrameId: 1
}));

vi.mock('../src/exhibition/assets/ExhibitionAssetLoader', () => ({
  ExhibitionAssetLoader: class {
    constructor(_renderer: unknown, assets: Array<{ id: string }>) {
      state.assetIds = assets.map((asset) => asset.id);
    }
    load = state.assetLoad.mockResolvedValue({
      models: new Map(),
      textures: new Map(),
      environment: null,
      audio: new Map([['lake-ambience', { duration: 10 }]]),
      failures: new Map()
    });
    loadAudio = state.assetLoadAudio.mockResolvedValue(
      new Map([['lake-ambience', { duration: 10 }]])
    );
    dispose = state.assetDispose;
  }
}));

vi.mock('../src/exhibition/audio/ExhibitionAudio', () => {
  class MockExhibitionAudio {
    unlock = state.audioUnlock;
    isUnlocked = () => true;
    setScene = state.audioSetScene;
    setBuffers = state.audioSetBuffers;
    setWaterPosition = state.audioSetWaterPosition;
    attachTo = state.audioAttachTo;
    detachFrom = state.audioDetachFrom;
    updateTravelledDistance = state.audioUpdateTravelledDistance;
    setMuted = state.audioSetMuted;
    dispose = state.audioDispose;
  }
  return {
    ExhibitionAudio: MockExhibitionAudio,
    createExhibitionAudio: () => new MockExhibitionAudio()
  };
});

vi.mock('../src/exhibition/quality/PostProcessingPipeline', () => ({
  PostProcessingPipeline: class {
    render = vi.fn();
    resize = vi.fn();
    setQuality = vi.fn();
    dispose = vi.fn();
  }
}));

vi.mock('../src/exhibition/scene/createWestLakeEnvironment', async () => {
  const THREE = await import('three');
  return {
    WEST_LAKE_COLLIDERS: [],
    createWestLakeEnvironment: () => ({
      root: new THREE.Group(),
      update: state.environmentUpdate,
      dispose: state.environmentDispose,
      setReducedMotion: vi.fn(),
      setZoneVisible: vi.fn()
    })
  };
});

vi.mock('../src/lib/three/disposeObject3D', () => ({ disposeObject3D: vi.fn() }));

vi.mock('three', () => {
  class Node {
    parent: Node | null = null;
    children: Node[] = [];
    position = {
      x: 0,
      y: 0,
      z: 0,
      set: (x: number, y: number, z: number) => {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
      }
    };
    rotation = { order: 'XYZ', set: vi.fn() };
    add(...children: Node[]) {
      children.forEach((child) => {
        child.parent = this;
        this.children.push(child);
      });
    }
    remove(child: Node) {
      this.children = this.children.filter((candidate) => candidate !== child);
      child.parent = null;
    }
  }

  return {
    Scene: class extends Node {
      background: unknown;
      fog: unknown;
    },
    Group: class extends Node {},
    PerspectiveCamera: class extends Node {
      aspect = 1;
      updateProjectionMatrix = vi.fn();
    },
    AudioListener: class extends Node {},
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      shadowMap = { enabled: false, type: 0 };
      outputColorSpace: unknown;
      toneMapping: unknown;
      toneMappingExposure = 1;
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      dispose = vi.fn();
      forceContextLoss = vi.fn();
    },
    HemisphereLight: class extends Node {},
    DirectionalLight: class extends Node {
      castShadow = false;
    },
    Color: class {
      constructor(readonly value: unknown) {}
    },
    FogExp2: class {
      constructor(
        readonly color: unknown,
        readonly density: number
      ) {}
    },
    Clock: class {
      getDelta() {
        return 0.1;
      }
    },
    MathUtils: {
      clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
    },
    PCFSoftShadowMap: 1,
    SRGBColorSpace: 'srgb',
    ACESFilmicToneMapping: 2
  };
});

import { WestLakeScene } from '../src/exhibition/westLakeScene';

describe('WestLakeScene audio lifecycle', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    state.animationFrames.clear();
    state.nextFrameId = 1;
    host = document.createElement('div');
    Object.defineProperties(host, {
      clientWidth: { value: 960 },
      clientHeight: { value: 540 }
    });
    document.body.appendChild(host);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe = vi.fn();
        disconnect = vi.fn();
      }
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = state.nextFrameId++;
      state.animationFrames.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => state.animationFrames.delete(id));
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('unlocks lake audio, emits travelled distance, and releases sources', async () => {
    const scene = new WestLakeScene({ host });
    await Promise.resolve();
    await Promise.resolve();

    expect(state.assetIds).toEqual(expect.arrayContaining(['lake-ambience', 'footstep-stone']));
    expect(state.assetLoadAudio).toHaveBeenCalledTimes(1);
    expect(state.assetLoad).not.toHaveBeenCalled();
    expect(state.audioSetScene).toHaveBeenCalledWith('lake');
    expect(state.audioSetBuffers).toHaveBeenCalledWith(
      new Map([['lake-ambience', { duration: 10 }]])
    );
    expect(state.audioSetWaterPosition).toHaveBeenCalledWith(0, 0, 0);

    host.querySelector('canvas')?.dispatchEvent(new MouseEvent('pointerdown'));
    await Promise.resolve();
    expect(state.audioUnlock).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    const waterUpdatesBeforeFrame = state.audioSetWaterPosition.mock.calls.length;
    const frame = state.animationFrames.entries().next().value as [number, FrameRequestCallback];
    state.animationFrames.delete(frame[0]);
    frame[1](100);
    expect(state.audioUpdateTravelledDistance.mock.calls.some(([distance]) => distance > 0)).toBe(
      true
    );
    expect(state.audioSetWaterPosition).toHaveBeenCalledTimes(waterUpdatesBeforeFrame + 1);

    scene.setMuted(true);
    expect(state.audioSetMuted).toHaveBeenCalledWith(true);
    scene.dispose();
    scene.dispose();
    expect(state.audioDetachFrom).toHaveBeenCalledTimes(1);
    expect(state.audioDispose).toHaveBeenCalledTimes(1);
    expect(state.assetDispose).toHaveBeenCalledTimes(1);
  });

  it('reports the lake ready after construction but before optional audio finishes loading', async () => {
    state.assetLoadAudio.mockImplementationOnce(() => new Promise(() => undefined));
    const onReady = vi.fn();

    const scene = new WestLakeScene({ host, onReady });

    expect(onReady).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onReady).toHaveBeenCalledTimes(1);
    scene.dispose();
  });
});
