import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  sceneChildren: [] as Array<{ name: string }>,
  render: vi.fn(),
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
  assetDispose: vi.fn()
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
    setQuality = vi.fn();
    dispose = vi.fn();
  }
}));

vi.mock('../src/exhibition/scene/createJiangnanHall', async () => {
  const THREE = await import('three');
  return {
    createJiangnanHall: () => {
      const hall = new THREE.Group();
      hall.name = 'jiangnan-museum-hall';
      return hall;
    }
  };
});

vi.mock('../src/exhibition/assets/ExhibitionAssetLoader', () => ({
  ExhibitionAssetLoader: class {
    load = state.assetLoad.mockResolvedValue({
      models: new Map(),
      textures: new Map(),
      environment: null,
      audio: new Map(),
      failures: new Map()
    });
    dispose = state.assetDispose;
  }
}));

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
      }
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
  }

  return {
    Scene: MockScene,
    PerspectiveCamera: MockCamera,
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
      shadow = { mapSize: { set: vi.fn() } };
    },
    PointLight: class extends MockNode {},
    CatmullRomCurve3: class {},
    MathUtils: {
      clamp: (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
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

  it('creates a named contemporary West Lake hall and observes its host size', () => {
    const renderer = new ExhibitionRenderer({ host, onExhibitSelect: vi.fn() });

    expect(host.querySelector('canvas')).not.toBeNull();
    expect(state.resizeObservers).toHaveLength(1);
    expect(state.resizeObservers[0]?.observe).toHaveBeenCalledWith(host);
    expect(state.assetLoad).toHaveBeenCalledTimes(1);
    expect(state.sceneChildren.map((child) => child.name)).toEqual(
      expect.arrayContaining(['jiangnan-museum-hall', 'hall-lighting', 'exhibits', 'greenery'])
    );

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
    expect(blockedPose.position.x).toBeLessThan(6);
    expect(blockedPose.position.z).toBeCloseTo(7.5);

    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' }));
    for (let index = 0; index < 15; index += 1) runFrame();

    const slidingPose = renderer.getCameraPose();
    expect(slidingPose.position.z).toBeLessThan(6.5);

    canvas.dispatchEvent(new MouseEvent('pointerdown'));
    const lookEvent = new MouseEvent('pointermove');
    Object.defineProperties(lookEvent, {
      movementX: { value: 30 },
      movementY: { value: -20 }
    });
    window.dispatchEvent(lookEvent);

    expect(state.render).toHaveBeenCalled();
    expect(renderer.getCameraPose().yaw).not.toBe(0);
    expect(renderer.getCameraPose().pitch).not.toBe(0);

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
    expect(host.querySelector('canvas')).toBeNull();
  });
});
