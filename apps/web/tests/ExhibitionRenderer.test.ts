import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  sceneChildren: [] as Array<{ name: string }>,
  render: vi.fn(),
  pipelineSetQuality: vi.fn(),
  pipelineSetFocus: vi.fn(),
  pipelineSetTransitionProgress: vi.fn(),
  rendererDispose: vi.fn(),
  forceContextLoss: vi.fn(),
  geometryDispose: vi.fn(),
  materialDispose: vi.fn(),
  textureDispose: vi.fn(),
  raycastIntersections: [] as Array<{
    object: { userData: Record<string, unknown>; parent: null };
  }>,
  resizeObservers: [] as MockResizeObserver[],
  animationFrames: new Map<number, FrameRequestCallback>(),
  nextFrameId: 1,
  assetLoad: vi.fn(),
  assetLoadAudio: vi.fn(),
  assetDispose: vi.fn(),
  assetIds: [] as string[],
  museumUpdate: vi.fn(),
  museumSetIesTexture: vi.fn(),
  audioUnlock: vi.fn().mockResolvedValue(undefined),
  audioSetScene: vi.fn(),
  audioSetBuffers: vi.fn(),
  audioPlayNarration: vi.fn(),
  audioStopNarration: vi.fn(),
  audioUpdateTravelledDistance: vi.fn(),
  audioSetMuted: vi.fn(),
  audioAttachTo: vi.fn(),
  audioDetachFrom: vi.fn(),
  audioDispose: vi.fn()
}));

class MockResizeObserver {
  observe = vi.fn();
  disconnect = vi.fn();

  constructor(readonly callback: ResizeObserverCallback) {
    state.resizeObservers.push(this);
  }
}

vi.mock('../src/exhibition/quality/PostProcessingPipeline', () => ({
  PostProcessingPipeline: class {
    render = state.render;
    resize = vi.fn();
    setQuality = state.pipelineSetQuality;
    setFocus = state.pipelineSetFocus;
    setTransitionProgress = state.pipelineSetTransitionProgress;
    dispose = vi.fn();
  }
}));

vi.mock('../src/exhibition/scene/createJiangnanHall', async () => {
  const THREE = await import('three');
  return {
    JIANGNAN_HALL_COLLIDERS: [],
    createJiangnanHall: () => {
      const hall = new THREE.Group();
      hall.name = 'jiangnan-museum-hall';
      return hall;
    }
  };
});

vi.mock('../src/exhibition/scene/createMuseumCases', async () => {
  const THREE = await import('three');
  return {
    createMuseumCases: () => {
      const root = new THREE.Group();
      root.name = 'museum-cases';
      return {
        root,
        areaLights: [],
        labels: [],
        focusLights: new Map(),
        glassMaterials: [],
        glassMeshes: [],
        iesLights: [],
        contactShadows: [],
        setIesTexture: state.museumSetIesTexture,
        setProximity: vi.fn(),
        update: state.museumUpdate
      };
    }
  };
});

vi.mock('../src/exhibition/assets/ExhibitionAssetLoader', () => ({
  ExhibitionAssetLoader: class {
    constructor(_renderer: unknown, assets: Array<{ id: string }>) {
      state.assetIds = assets.map((asset) => asset.id);
    }
    load = state.assetLoad.mockResolvedValue({
      models: new Map(),
      textures: new Map([['display-ies', { isTexture: true }]]),
      environment: null,
      audio: new Map([['hall-ambience', { duration: 10 }]]),
      failures: new Map()
    });
    loadAudio = state.assetLoadAudio.mockResolvedValue(
      new Map([['hall-ambience', { duration: 10 }]])
    );
    dispose = state.assetDispose;
  }
}));

vi.mock('../src/exhibition/audio/ExhibitionAudio', () => {
  class MockExhibitionAudio {
    unlock = state.audioUnlock;
    setScene = state.audioSetScene;
    setBuffers = state.audioSetBuffers;
    playNarration = state.audioPlayNarration;
    stopNarration = state.audioStopNarration;
    updateTravelledDistance = state.audioUpdateTravelledDistance;
    setMuted = state.audioSetMuted;
    attachTo = state.audioAttachTo;
    detachFrom = state.audioDetachFrom;
    dispose = state.audioDispose;
    isUnlocked = () => true;
  }
  return {
    ExhibitionAudio: MockExhibitionAudio,
    createExhibitionAudio: () => new MockExhibitionAudio()
  };
});

vi.mock('three', () => {
  class MockNode {
    name = '';
    userData: Record<string, unknown> = {};
    children: MockNode[] = [];
    parent: MockNode | null = null;
    geometry?: { dispose: () => void };
    material?: { dispose: () => void; map?: { dispose: () => void } };
    position = {
      x: 0,
      y: 0,
      z: 0,
      set: (x: number, y: number, z: number) => {
        this.position.x = x;
        this.position.y = y;
        this.position.z = z;
      },
      clone: () => ({
        x: this.position.x,
        y: this.position.y,
        z: this.position.z
      })
    };
    rotation = { x: 0, y: 0, z: 0, order: 'XYZ', set: vi.fn() };
    scale = { x: 1, y: 1, z: 1, set: vi.fn(), setScalar: vi.fn() };

    add(...nodes: MockNode[]) {
      for (const node of nodes) {
        node.parent = this;
        this.children.push(node);
        if (this.name === 'scene') state.sceneChildren.push(node);
      }
    }

    traverse(callback: (node: MockNode) => void) {
      callback(this);
      for (const child of this.children) child.traverse(callback);
    }

    lookAt() {}
    updateMatrixWorld() {}
  }

  class MockScene extends MockNode {
    background: unknown = null;
    constructor() {
      super();
      this.name = 'scene';
    }
  }

  class MockCamera extends MockNode {
    aspect = 1;
    updateProjectionMatrix = vi.fn();
  }

  class MockAudioListener extends MockNode {}

  class MockMesh extends MockNode {
    castShadow = false;
    receiveShadow = false;
    constructor(
      geometry: { dispose: () => void },
      material: { dispose: () => void; map?: { dispose: () => void } }
    ) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }

  class MockGeometry {
    dispose = state.geometryDispose;
    rotateX() {
      return this;
    }
  }

  class MockMaterial {
    dispose = state.materialDispose;
    map = { dispose: state.textureDispose };
    normalScale = { set: vi.fn() };
  }

  return {
    Scene: MockScene,
    PerspectiveCamera: MockCamera,
    AudioListener: MockAudioListener,
    WebGLRenderer: class {
      domElement = document.createElement('canvas');
      shadowMap = { enabled: false, type: 0 };
      setPixelRatio = vi.fn();
      setSize = vi.fn();
      render = state.render;
      dispose = state.rendererDispose;
      forceContextLoss = state.forceContextLoss;
    },
    Group: class extends MockNode {},
    Mesh: MockMesh,
    BoxGeometry: MockGeometry,
    PlaneGeometry: MockGeometry,
    CylinderGeometry: MockGeometry,
    SphereGeometry: MockGeometry,
    TorusGeometry: MockGeometry,
    TubeGeometry: MockGeometry,
    LatheGeometry: MockGeometry,
    MeshStandardMaterial: MockMaterial,
    MeshPhysicalMaterial: MockMaterial,
    MeshBasicMaterial: MockMaterial,
    Color: class {
      constructor(readonly value: unknown) {}
    },
    Vector2: class {
      constructor(
        public x = 0,
        public y = 0
      ) {}
      set(x: number, y: number) {
        this.x = x;
        this.y = y;
      }
    },
    Vector3: class {
      constructor(
        public x = 0,
        public y = 0,
        public z = 0
      ) {}
      set(x: number, y: number, z: number) {
        this.x = x;
        this.y = y;
        this.z = z;
        return this;
      }
      clone() {
        return { x: this.x, y: this.y, z: this.z };
      }
    },
    Euler: class {
      constructor(
        public x = 0,
        public y = 0,
        public z = 0,
        public order = 'XYZ'
      ) {}
    },
    Raycaster: class {
      setFromCamera() {}
      intersectObjects() {
        return state.raycastIntersections;
      }
    },
    Clock: class {
      getDelta() {
        return 0.1;
      }
    },
    HemisphereLight: class extends MockNode {},
    AmbientLight: class extends MockNode {},
    DirectionalLight: class extends MockNode {
      castShadow = false;
      shadow = {
        mapSize: { set: vi.fn() },
        camera: { left: 0, right: 0, top: 0, bottom: 0, near: 0, far: 0 }
      };
    },
    PointLight: class extends MockNode {},
    CatmullRomCurve3: class {},
    MathUtils: {
      clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value)),
      smoothstep: (value: number, min: number, max: number) => {
        const x = Math.min(1, Math.max(0, (value - min) / (max - min)));
        return x * x * (3 - 2 * x);
      }
    },
    PCFSoftShadowMap: 1,
    DoubleSide: 2,
    SRGBColorSpace: 'srgb'
  };
});

vi.mock('../src/lib/three/disposeObject3D', () => ({
  disposeObject3D(root: {
    traverse: (
      callback: (node: {
        geometry?: { dispose: () => void };
        material?: { dispose: () => void; map?: { dispose: () => void } };
      }) => void
    ) => void;
  }) {
    const textures = new Set<unknown>();
    root.traverse((node) => {
      node.geometry?.dispose();
      if (node.material?.map && !textures.has(node.material.map)) {
        textures.add(node.material.map);
        node.material.map.dispose();
      }
      node.material?.dispose();
    });
  }
}));

import { ExhibitionRenderer } from '../src/exhibition/ExhibitionRenderer';

describe('ExhibitionRenderer', () => {
  let host: HTMLDivElement;

  beforeEach(() => {
    state.sceneChildren.length = 0;
    state.raycastIntersections.length = 0;
    state.resizeObservers.length = 0;
    state.animationFrames.clear();
    state.nextFrameId = 1;
    state.assetIds = [];
    vi.clearAllMocks();

    host = document.createElement('div');
    Object.defineProperties(host, {
      clientWidth: { configurable: true, value: 960 },
      clientHeight: { configurable: true, value: 540 }
    });
    document.body.appendChild(host);

    vi.stubGlobal('ResizeObserver', MockResizeObserver);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = state.nextFrameId++;
      state.animationFrames.set(id, callback);
      return id;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => {
      state.animationFrames.delete(id);
    });
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('creates the Jiangnan hall with museum cases and loads its IES profile', async () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });

    await Promise.resolve();
    await Promise.resolve();

    expect(host.querySelector('canvas')).not.toBeNull();
    expect(state.resizeObservers).toHaveLength(1);
    expect(state.resizeObservers[0]?.observe).toHaveBeenCalledWith(host);
    expect(state.assetLoad).toHaveBeenCalledTimes(1);
    expect(state.sceneChildren.map((child) => child.name)).toEqual(
      expect.arrayContaining(['jiangnan-museum-hall', 'museum-cases', 'hall-lighting', 'exhibits'])
    );
    expect(state.assetIds).toContain('display-ies');
    expect(state.assetIds).toEqual(
      expect.arrayContaining(['hall-ambience', 'footstep-stone', 'narration-bicycle'])
    );
    expect(state.museumSetIesTexture).toHaveBeenCalledWith({ isTexture: true });
    expect(state.audioSetScene).toHaveBeenCalledWith('hall');
    expect(state.audioSetBuffers).toHaveBeenCalledWith(
      new Map([['hall-ambience', { duration: 10 }]])
    );
    expect(state.sceneChildren.map((child) => child.name)).not.toContain('greenery');

    renderer.dispose();
  });

  it('updates first-person look and moves with axis-safe collision', () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;

    const runFrame = () => {
      const entry = state.animationFrames.entries().next().value as
        [number, FrameRequestCallback] | undefined;
      expect(entry).toBeDefined();
      if (!entry) return;
      state.animationFrames.delete(entry[0]);
      entry[1](100);
    };

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyD' }));
    for (let index = 0; index < 45; index += 1) runFrame();

    const blockedPose = renderer.getCameraPose();
    expect(blockedPose.position.x).toBeCloseTo(21.6);
    expect(blockedPose.position.z).toBeCloseTo(57.2);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let index = 0; index < 15; index += 1) runFrame();

    const slidingPose = renderer.getCameraPose();
    expect(slidingPose.position.z).toBeLessThan(blockedPose.position.z);

    canvas.dispatchEvent(new MouseEvent('pointerdown'));
    const lookEvent = new MouseEvent('pointermove');
    Object.defineProperties(lookEvent, {
      movementX: { value: 30 },
      movementY: { value: -20 }
    });
    window.dispatchEvent(lookEvent);

    expect(state.render).toHaveBeenCalled();
    expect(state.museumUpdate).toHaveBeenCalledWith(0.1);
    expect(renderer.getCameraPose().yaw).not.toBe(0);
    expect(renderer.getCameraPose().pitch).not.toBe(0);
    expect(state.audioUnlock).toHaveBeenCalledTimes(1);
    expect(state.audioUpdateTravelledDistance).toHaveBeenCalledWith(expect.any(Number));
    expect(state.audioUpdateTravelledDistance.mock.calls.some(([distance]) => distance > 0)).toBe(
      true
    );

    renderer.dispose();
  });

  it('raycasts clickable exhibits and reports the nearest exhibit id', () => {
    const onExhibitSelect = vi.fn();
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect });
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      toJSON: () => ({})
    });
    const exhibit = { userData: { exhibitId: 'west-lake-bicycle' }, parent: null };
    state.raycastIntersections.push({ object: exhibit });

    canvas.dispatchEvent(new MouseEvent('click', { clientX: 200, clientY: 120 }));

    expect(onExhibitSelect).toHaveBeenCalledWith('west-lake-bicycle');
    expect(state.audioPlayNarration).toHaveBeenCalledWith('west-lake-bicycle');
    renderer.dispose();
  });

  it('exposes mute and narration cleanup for the page detail lifecycle', () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });

    renderer.setMuted(true);
    renderer.playNarration('silk-and-tea');
    renderer.setInteractionEnabled(false);
    renderer.setInteractionEnabled(true);

    expect(state.audioSetMuted).toHaveBeenCalledWith(true);
    expect(state.audioPlayNarration).toHaveBeenCalledWith('silk-and-tea');
    expect(state.audioStopNarration).toHaveBeenCalledTimes(1);
    renderer.dispose();
  });

  it('reports real loading state and exposes page orchestration controls', async () => {
    const onProgress = vi.fn();
    const onReady = vi.fn();
    const onQualityChange = vi.fn();
    const onRecoverableFailure = vi.fn();
    state.assetLoad.mockImplementationOnce(async (reportProgress: (value: unknown) => void) => {
      reportProgress({ loadedBytes: 40, totalBytes: 100, completed: 2, total: 5 });
      return {
        models: new Map(),
        textures: new Map(),
        environment: null,
        audio: new Map(),
        failures: new Map([['bicycle', new Error('model unavailable')]])
      };
    });
    const renderer = new ExhibitionRenderer({
      host,
      onExhibitSelect: vi.fn(),
      onProgress,
      onReady,
      onQualityChange,
      onRecoverableFailure
    });

    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    expect(onProgress).toHaveBeenCalledWith({
      loadedBytes: 40,
      totalBytes: 100,
      completed: 2,
      total: 5
    });
    expect(onRecoverableFailure).toHaveBeenCalledWith('bicycle');

    await renderer.unlockAudio();
    renderer.setQuality('medium');
    renderer.setFocus('west-lake-bicycle');
    renderer.setTransitionProgress(0.75);

    expect(state.audioUnlock).toHaveBeenCalled();
    expect(state.pipelineSetQuality).toHaveBeenCalledWith('medium');
    expect(state.pipelineSetFocus).toHaveBeenCalledWith(expect.anything());
    expect(state.pipelineSetTransitionProgress).toHaveBeenCalledWith(0.75);
    expect(onQualityChange).toHaveBeenCalledWith('medium');
    renderer.dispose();
  });

  it('reports the hall ready only after its visual assets finish processing', async () => {
    let finishLoading: (() => void) | undefined;
    state.assetLoad.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishLoading = () =>
            resolve({
              models: new Map(),
              textures: new Map(),
              environment: null,
              audio: new Map(),
              failures: new Map()
            });
        })
    );
    const onReady = vi.fn();

    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn(), onReady });

    expect(onReady).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(onReady).not.toHaveBeenCalled();
    finishLoading?.();
    await vi.waitFor(() => expect(onReady).toHaveBeenCalledTimes(1));
    renderer.dispose();
  });

  it('keeps the procedural West Lake sand table after realistic assets replace other exhibits', async () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });

    await vi.waitFor(() => expect(state.assetLoad).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => {
      const exhibits = state.sceneChildren.find((child) => child.name === 'exhibits') as
        { children?: Array<{ name: string; visible?: boolean }> } | undefined;
      const sandTable = exhibits?.children?.find(
        (child) => child.name === 'west-lake-map-sand-table'
      );
      expect(sandTable).toBeDefined();
      expect(sandTable?.visible).not.toBe(false);
    });

    renderer.dispose();
  });

  it('stops movement while interaction is disabled and clears input on blur', () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });
    const runFrame = () => {
      const entry = state.animationFrames.entries().next().value as
        [number, FrameRequestCallback] | undefined;
      expect(entry).toBeDefined();
      if (!entry) return;
      state.animationFrames.delete(entry[0]);
      entry[1](100);
    };

    const before = renderer.getCameraPose();
    renderer.setInteractionEnabled(false);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    runFrame();
    expect(renderer.getCameraPose()).toEqual(before);

    renderer.setInteractionEnabled(true);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    window.dispatchEvent(new Event('blur'));
    runFrame();
    expect(renderer.getCameraPose()).toEqual(before);

    renderer.dispose();
  });

  it('shows a pointer cursor while hovering the nearest interactive exhibit', () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });
    const canvas = host.querySelector('canvas') as HTMLCanvasElement;
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 960,
      bottom: 540,
      width: 960,
      height: 540,
      toJSON: () => ({})
    });
    state.raycastIntersections.push({
      object: { userData: { exhibitId: 'west-lake-bicycle' }, parent: null }
    });

    canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 200, clientY: 120 }));

    expect(canvas.style.cursor).toBe('pointer');
    renderer.dispose();
  });

  it('disconnects observers and releases all renderer resources exactly once', () => {
    const keydownSpy = vi.spyOn(window, 'removeEventListener');
    const canvasRemoveSpy = vi.spyOn(HTMLCanvasElement.prototype, 'removeEventListener');
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });
    const observer = state.resizeObservers[0];

    renderer.dispose();
    renderer.dispose();

    expect(observer?.disconnect).toHaveBeenCalledTimes(1);
    expect(keydownSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
    expect(keydownSpy).toHaveBeenCalledWith('keyup', expect.any(Function));
    expect(canvasRemoveSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function));
    expect(canvasRemoveSpy).toHaveBeenCalledWith('click', expect.any(Function));
    expect(state.animationFrames.size).toBe(0);
    expect(state.geometryDispose).toHaveBeenCalled();
    expect(state.materialDispose).toHaveBeenCalled();
    expect(state.textureDispose).toHaveBeenCalled();
    expect(state.rendererDispose).toHaveBeenCalledTimes(1);
    expect(state.forceContextLoss).toHaveBeenCalledTimes(1);
    expect(state.assetDispose).toHaveBeenCalledTimes(1);
    expect(state.audioDispose).toHaveBeenCalledTimes(1);
    expect(state.audioDetachFrom).toHaveBeenCalledTimes(1);
    expect(host.querySelector('canvas')).toBeNull();
  });
});
