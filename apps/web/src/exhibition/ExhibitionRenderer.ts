import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import {
  PLAYER_RADIUS,
  ROOM_BOUNDS,
  clampFrameDelta,
  normalizeMovement,
  resolveMovement,
  type Collider
} from './collision';
import { EXHIBITION_LAYOUT, findExhibitLayout } from './exhibitionLayout';
import {
  EXHIBITION_COLORS as COLORS,
  applyHallPbrTextures,
  createHallMaterials,
  type HallMaterials
} from './exhibitionMaterials';
import { ExhibitionAssetLoader, type AssetProgress } from './assets/ExhibitionAssetLoader';
import { EXHIBITION_ASSETS } from './assets/exhibitionAssets';
import { ExhibitionAudio, createExhibitionAudio } from './audio/ExhibitionAudio';
import {
  FALLBACK_ASSET_SOURCES,
  publishExhibitionTelemetry,
  type ExhibitionAssetSources
} from './exhibitionTelemetry';
import { PostProcessingPipeline } from './quality/PostProcessingPipeline';
import {
  QUALITY_PROFILES,
  QualityDowngradeController,
  type QualityLevel
} from './quality/qualityProfile';
import { JIANGNAN_HALL_COLLIDERS, createJiangnanHall } from './scene/createJiangnanHall';
import { createMuseumCases } from './scene/createMuseumCases';
import { createRealisticExhibits } from './scene/createRealisticExhibits';
import {
  SHOWROOM_ZONES,
  createCuratedShowroom,
  type CuratedShowroom
} from './scene/createCuratedShowroom';

export type ExhibitionRendererOptions = {
  host: HTMLElement;
  onExhibitSelect: (exhibitId: string) => void;
  onProgress?: (progress: AssetProgress) => void;
  onReady?: () => void;
  onQualityChange?: (quality: QualityLevel) => void;
  onRecoverableFailure?: (assetId: string) => void;
  onFatalError?: (error: Error) => void;
  onZoneChange?: (zoneId: string) => void;
  audio?: ExhibitionAudio;
};

export type ExhibitionCameraPose = {
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
};

const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 5;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI * 0.45;
const ZONE_CAMERA_VIEWS: Record<
  string,
  { position: [number, number, number]; target: [number, number, number] }
> = {
  entrance: { position: [6.5, EYE_HEIGHT, 57.2], target: [0, 2.25, 52] },
  wuzhen: { position: [5.2, EYE_HEIGHT, 43.2], target: [0, 2.1, 38] },
  global: { position: [4.8, EYE_HEIGHT, 29.2], target: [0, 1.9, 24] },
  interactive: { position: [5.1, EYE_HEIGHT, 15.2], target: [0, 2.35, 10] },
  // Stay in the central aisle: the boat, tea table, and rear image wall read as one composition.
  supporting: { position: [10.8, EYE_HEIGHT, -0.8], target: [11.8, 1.8, -4.1] },
  // Start outside the foreground reading desk to keep the gallery wall and resting area in view.
  culture: { position: [-1.2, EYE_HEIGHT, -11.6], target: [3.2, 1.9, -18] }
};

function createBox(
  width: number,
  height: number,
  depth: number,
  materialOrColor: THREE.Material | string,
  roughness = 0.72
) {
  const material =
    typeof materialOrColor === 'string'
      ? new THREE.MeshStandardMaterial({ color: materialOrColor, roughness, metalness: 0.08 })
      : materialOrColor;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function markExhibit(root: THREE.Object3D, exhibitId: string) {
  root.userData.exhibitId = exhibitId;
  root.traverse((object) => {
    object.userData.exhibitId = exhibitId;
  });
}

export class ExhibitionRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 80);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly assetLoader: ExhibitionAssetLoader;
  private readonly audio: ExhibitionAudio;
  private readonly ownsAudio: boolean;
  private readonly pipeline: PostProcessingPipeline;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly pressedKeys = new Set<string>();
  private readonly colliders: Collider[] = [
    ...JIANGNAN_HALL_COLLIDERS,
    ...EXHIBITION_LAYOUT.flatMap((item) =>
      item.blocksMovement && item.collider ? [item.collider] : []
    )
  ];
  private readonly exhibitRoots: THREE.Object3D[] = [];
  private readonly exhibitGroup = new THREE.Group();
  private readonly materials: HallMaterials = createHallMaterials();
  private readonly museumCases: ReturnType<typeof createMuseumCases>;
  private readonly showroom: CuratedShowroom;
  private readonly resizeObserver: ResizeObserver;
  private frameId = 0;
  private disposed = false;
  private looking = false;
  private interactionEnabled = true;
  private yaw = 0;
  private pitch = 0;
  private rollingFps = 0;
  private readonly qualityController = new QualityDowngradeController(
    'high',
    50,
    20_000,
    5_000,
    performance.now()
  );
  private qualitySampleStartedAt = performance.now();
  private qualitySampleFrames = 0;
  private quality: QualityLevel = 'high';
  private activeZoneId: string = SHOWROOM_ZONES[0].id;
  private manualQuality: QualityLevel | null = null;
  private fatalErrorReported = false;
  private assetSources: ExhibitionAssetSources = { ...FALLBACK_ASSET_SOURCES };

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (!this.interactionEnabled) return;
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow')) {
      this.pressedKeys.add(event.code);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handlePointerDown = () => {
    if (!this.interactionEnabled) return;
    void this.unlockAudio();
    this.looking = true;
    this.renderer.domElement.requestPointerLock?.();
  };

  private readonly handlePointerUp = () => {
    this.looking = false;
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.interactionEnabled) return;
    if (!this.looking && document.pointerLockElement !== this.renderer.domElement) return;

    // 指针锁定后使用相对位移观察展馆，并限制俯仰角避免镜头翻转。
    this.yaw -= event.movementX * LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
    this.applyCameraRotation();
  };

  private readonly handleBlur = () => {
    this.pressedKeys.clear();
    this.looking = false;
  };

  private readonly handlePointerLockChange = () => {
    this.looking = document.pointerLockElement === this.renderer.domElement;
  };

  private readonly handlePointerHover = (event: PointerEvent) => {
    if (!this.interactionEnabled || document.pointerLockElement === this.renderer.domElement) {
      this.renderer.domElement.style.cursor = '';
      return;
    }
    this.renderer.domElement.style.cursor = this.findExhibitId(event.clientX, event.clientY)
      ? 'pointer'
      : '';
  };

  private readonly handleClick = (event: MouseEvent) => {
    if (!this.interactionEnabled) return;
    const exhibitId = this.findExhibitId(event.clientX, event.clientY);
    if (exhibitId) {
      this.audio.playNarration(exhibitId);
      this.options.onExhibitSelect(exhibitId);
    }
  };

  private findExhibitId(clientX: number, clientY: number): string | null {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return null;

    this.pointer.set(
      ((clientX - bounds.left) / bounds.width) * 2 - 1,
      -((clientY - bounds.top) / bounds.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.exhibitRoots, true);

    // 命中的通常是展品子网格，向父级查找统一标记的展品 ID。
    for (const intersection of intersections) {
      let object: THREE.Object3D | null = intersection.object;
      while (object) {
        const exhibitId = object.userData.exhibitId;
        if (typeof exhibitId === 'string') {
          return exhibitId;
        }
        object = object.parent;
      }
    }
    return null;
  }

  constructor(private readonly options: ExhibitionRendererOptions) {
    this.scene.background = new THREE.Color('#2b3432');
    this.camera.position.set(...ZONE_CAMERA_VIEWS.entrance.position);
    this.camera.rotation.order = 'YXZ';

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.04;
    this.options.host.appendChild(this.renderer.domElement);
    RectAreaLightUniformsLib.init();
    this.audio = this.options.audio ?? createExhibitionAudio();
    this.ownsAudio = !this.options.audio;
    this.audio.setScene('hall');

    const hallAssets = EXHIBITION_ASSETS.filter((asset) =>
      [
        'hall-hdri',
        'stone-pbr',
        'walnut-pbr',
        'display-ies',
        'bicycle',
        'shuttle',
        'tea-set',
        'silk-garment',
        'hall-ambience',
        'footstep-stone',
        'narration-bicycle',
        'narration-shuttle',
        'narration-tea-set',
        'narration-silk-garment'
      ].includes(asset.id)
    );
    this.assetLoader = new ExhibitionAssetLoader(this.renderer, hallAssets);
    this.showroom = createCuratedShowroom(this.materials);
    this.exhibitRoots.push(...this.showroom.exhibitRoots);
    this.museumCases = createMuseumCases(
      EXHIBITION_LAYOUT,
      this.materials,
      QUALITY_PROFILES[this.qualityController.getLevel()]
    );

    this.setupHall();
    void this.loadHallAudio();
    void this.loadHallEnvironment();
    this.pipeline = new PostProcessingPipeline({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      reducedMotion:
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
    });
    this.attachListeners();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(this.options.host);
    this.resize();
    this.scheduleFrame();
    this.options.onQualityChange?.(this.quality);
  }

  resize() {
    if (this.disposed) return;
    const width = Math.max(this.options.host.clientWidth, 1);
    const height = Math.max(this.options.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.pipeline.resize(width, height, window.devicePixelRatio || 1);
  }

  getCameraPose(): ExhibitionCameraPose {
    return {
      position: {
        x: this.camera.position.x,
        y: this.camera.position.y,
        z: this.camera.position.z
      },
      yaw: this.yaw,
      pitch: this.pitch
    };
  }

  setInteractionEnabled(enabled: boolean) {
    this.interactionEnabled = enabled;
    if (!enabled) {
      this.handleBlur();
      this.renderer.domElement.style.cursor = '';
      document.exitPointerLock?.();
    }
    if (enabled) this.audio.stopNarration();
  }

  setMuted(muted: boolean) {
    this.audio.setMuted(muted);
  }

  async unlockAudio() {
    await this.audio.unlock();
    if (!this.disposed) this.audio.attachTo(this.camera);
    this.publishTelemetry();
  }

  setQuality(quality: QualityLevel) {
    this.manualQuality = quality;
    this.applyQuality(quality);
  }

  setFocus(exhibitId: string | null) {
    if (!exhibitId) {
      this.pipeline.setFocus(null);
      return;
    }
    const layout = EXHIBITION_LAYOUT.find((item) => item.id === exhibitId);
    this.pipeline.setFocus(
      layout ? new THREE.Vector3(layout.position.x, layout.position.y, layout.position.z) : null
    );
  }

  setTransitionProgress(progress: number) {
    this.pipeline.setTransitionProgress(progress);
  }

  goToZone(zoneId: string) {
    const zone = SHOWROOM_ZONES.find((candidate) => candidate.id === zoneId);
    if (!zone) return;
    const view = ZONE_CAMERA_VIEWS[zoneId] ?? {
      position: [0, EYE_HEIGHT, Math.min(zone.z + 3.8, 57.2)] as [number, number, number],
      target: [0, EYE_HEIGHT, zone.z] as [number, number, number]
    };
    this.camera.position.set(...view.position);
    this.camera.lookAt(...view.target);
    this.yaw = this.camera.rotation.y;
    this.pitch = this.camera.rotation.x;
    this.setActiveZone(zoneId);
  }

  playNarration(exhibitId: string) {
    return this.audio.playNarration(exhibitId);
  }

  stopNarration() {
    this.audio.stopNarration();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.pressedKeys.clear();
    window.cancelAnimationFrame(this.frameId);
    this.resizeObserver.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    window.removeEventListener('blur', this.handleBlur);
    document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerHover);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    // 同时释放几何体、材质、WebGL 上下文和画布，防止重复进出页面耗尽显存。
    disposeObject3D(this.scene);
    this.audio.detachFrom(this.camera);
    if (this.ownsAudio) this.audio.dispose();
    this.assetLoader.dispose();
    this.pipeline.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();

    if (this.renderer.domElement.parentElement === this.options.host) {
      this.options.host.removeChild(this.renderer.domElement);
    }
  }

  private attachListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);
    window.addEventListener('blur', this.handleBlur);
    document.addEventListener('pointerlockchange', this.handlePointerLockChange);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerHover);
    this.renderer.domElement.addEventListener('click', this.handleClick);
  }

  private setupHall() {
    this.scene.add(createJiangnanHall(this.materials));
    this.scene.add(this.museumCases.root);
    this.scene.add(this.createLighting());
    this.scene.add(this.createExhibits());
    this.scene.add(this.showroom.root);
  }

  private updateSidePlatformVisibility() {
    // The four hands-on displays belong to the side platforms, not the central aisle.
    const insidePlatform = Math.abs(this.camera.position.x) >= 6.5;
    this.exhibitGroup.visible = insidePlatform;
    this.museumCases.root.visible = insidePlatform;
  }

  private async loadHallEnvironment() {
    try {
      const loaded = await this.assetLoader.load(this.options.onProgress ?? (() => undefined));
      if (this.disposed) return;
      if (loaded.environment) {
        this.scene.environment = loaded.environment;
        // Keep the HDRI as a restrained reflection/fill source; the hall's authored lights
        // should define the visible exposure and preserve wall/display detail.
        this.scene.environmentIntensity = 0.34;
      }
      const anisotropy = this.renderer.capabilities?.getMaxAnisotropy?.() ?? 1;
      applyHallPbrTextures(this.materials, loaded.textures, anisotropy);
      const iesTexture = loaded.textures.get('display-ies');
      if (iesTexture) this.museumCases.setIesTexture(iesTexture);
      const realistic = createRealisticExhibits(loaded, EXHIBITION_LAYOUT);
      const retainedRoots = this.exhibitRoots.filter((root) => {
        const replaced = realistic.roots.has(root.userData.exhibitId as string);
        if (replaced) root.visible = false;
        return !replaced;
      });
      this.exhibitRoots.length = 0;
      this.exhibitRoots.push(...retainedRoots);
      for (const root of realistic.roots.values()) {
        this.exhibitGroup.add(root);
        this.exhibitRoots.push(root);
        const source = root.userData.assetSource === 'glb' ? 'glb' : 'fallback';
        if (root.userData.exhibitId === 'west-lake-bicycle') this.assetSources.bicycle = source;
        if (root.userData.exhibitId === 'green-mobility-car') this.assetSources.shuttle = source;
        if (root.userData.exhibitId === 'silk-and-tea') this.assetSources.teaSet = source;
        if (root.userData.exhibitId === 'silk-garment') this.assetSources.silkGarment = source;
      }
      for (const assetId of loaded.failures.keys()) {
        this.options.onRecoverableFailure?.(assetId);
      }
      this.publishTelemetry();
      this.options.onReady?.();
    } catch (error) {
      this.reportFatalError(error);
    }
  }

  private async loadHallAudio() {
    const audio = await this.assetLoader.loadAudio(() => undefined);
    if (!this.disposed) this.audio.setBuffers(audio);
  }

  private createLighting() {
    const lighting = new THREE.Group();
    lighting.name = 'hall-lighting';
    lighting.add(new THREE.HemisphereLight('#fff9e8', '#234b42', 0.82));
    lighting.add(new THREE.AmbientLight('#d8eadf', 0.28));

    const sun = new THREE.DirectionalLight('#f1dfc4', 0.78);
    sun.position.set(8, 8, 46);
    sun.castShadow = true;
    sun.shadow.mapSize.set(
      QUALITY_PROFILES[this.qualityController.getLevel()].shadowMapSize,
      QUALITY_PROFILES[this.qualityController.getLevel()].shadowMapSize
    );
    sun.shadow.camera.left = -8;
    sun.shadow.camera.right = 8;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 24;
    sun.shadow.camera.left = -25;
    sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 62;
    sun.shadow.camera.bottom = -62;
    sun.shadow.camera.far = 140;
    lighting.add(sun);
    const zoneLights = [
      { color: '#efd3a0', x: -5.5 },
      { color: '#9bd0bd', x: 5.5 },
      { color: '#dfb46d', x: -5.5 },
      { color: '#7ca7c4', x: 5.5 },
      { color: '#d5a965', x: -5.5 },
      { color: '#a9b7d5', x: 5.5 }
    ];
    SHOWROOM_ZONES.forEach((zone, index) => {
      const lightSpec = zoneLights[index];
      const zoneLight = new THREE.PointLight(lightSpec.color, 0.46, 18, 2);
      zoneLight.position.set(0, 5.55, zone.z);
      const sideFill = new THREE.PointLight(lightSpec.color, 0.18, 11, 2);
      sideFill.position.set(lightSpec.x, 2.8, zone.z - 2.8);
      lighting.add(zoneLight, sideFill);
    });

    return lighting;
  }

  private createExhibits() {
    const exhibits = this.exhibitGroup;
    exhibits.name = 'exhibits';

    const bicycle = this.createBicycle();
    const car = this.createCar();
    exhibits.add(bicycle, car);
    return exhibits;
  }

  private createBicycle() {
    const bicycle = new THREE.Group();
    const layout = findExhibitLayout('west-lake-bicycle');
    bicycle.position.set(layout.position.x, layout.position.y, layout.position.z);
    const metal = new THREE.MeshStandardMaterial({
      color: COLORS.gold,
      metalness: 0.78,
      roughness: 0.3
    });
    const tire = new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.82 });

    for (const x of [-0.78, 0.78]) {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.62, 0.075, 10, 24), tire);
      wheel.position.x = x;
      bicycle.add(wheel);
    }
    const frameBar = createBox(1.45, 0.08, 0.08, COLORS.gold, 0.3);
    frameBar.rotation.z = -0.2;
    const seat = createBox(0.42, 0.08, 0.22, COLORS.ink);
    seat.position.set(0.18, 0.55, 0);
    const handle = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.04, 8, 16, Math.PI), metal);
    handle.position.set(0.72, 0.58, 0);
    bicycle.add(frameBar, seat, handle);
    markExhibit(bicycle, 'west-lake-bicycle');
    this.exhibitRoots.push(bicycle);
    return bicycle;
  }

  private createCar() {
    const car = new THREE.Group();
    const layout = findExhibitLayout('green-mobility-car');
    car.position.set(layout.position.x, layout.position.y, layout.position.z);
    const body = createBox(3.3, 0.68, 1.45, COLORS.car, 0.28);
    body.position.y = 0.72;
    const cabin = createBox(1.65, 0.62, 1.18, COLORS.mint, 0.18);
    cabin.position.set(-0.15, 1.28, 0);
    car.add(body, cabin);
    for (const x of [-1.1, 1.1]) {
      for (const z of [-0.72, 0.72]) {
        const wheel = new THREE.Mesh(
          new THREE.CylinderGeometry(0.32, 0.32, 0.18, 18),
          new THREE.MeshStandardMaterial({ color: COLORS.ink, roughness: 0.9 })
        );
        wheel.rotation.x = Math.PI / 2;
        wheel.position.set(x, 0.42, z);
        car.add(wheel);
      }
    }
    markExhibit(car, 'green-mobility-car');
    this.exhibitRoots.push(car);
    return car;
  }

  private applyCameraRotation() {
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  }

  private scheduleFrame() {
    if (this.disposed) return;
    this.frameId = window.requestAnimationFrame(() => this.renderFrame());
  }

  private renderFrame() {
    if (this.disposed) return;
    const deltaSeconds = clampFrameDelta(this.clock.getDelta());
    this.updateMovement(deltaSeconds);
    this.updateSidePlatformVisibility();
    this.updateMuseumCases(deltaSeconds);
    this.showroom.update(deltaSeconds);
    this.sampleQuality();
    try {
      this.pipeline.render(deltaSeconds);
    } catch (error) {
      this.reportFatalError(error);
      return;
    }
    this.publishTelemetry();
    this.scheduleFrame();
  }

  private updateMuseumCases(deltaSeconds: number) {
    for (const label of this.museumCases.labels) {
      const parent = label.parent;
      const exhibitId = label.userData.exhibitId;
      if (!parent || typeof exhibitId !== 'string') continue;
      const dx = this.camera.position.x - parent.position.x;
      const dz = this.camera.position.z - parent.position.z;
      const distance = Math.sqrt(dx * dx + dz * dz);
      const amount = THREE.MathUtils.smoothstep(3 - distance, 0, 0.6);
      this.museumCases.setProximity(exhibitId, amount);
    }
    this.museumCases.update(deltaSeconds);
  }

  private sampleQuality() {
    this.qualitySampleFrames += 1;
    const now = performance.now();
    const elapsed = now - this.qualitySampleStartedAt;
    if (elapsed < 1_000) return;
    const fps = (this.qualitySampleFrames * 1_000) / elapsed;
    this.rollingFps = fps;
    const sampled = this.manualQuality ?? this.qualityController.sample(fps, now);
    this.applyQuality(sampled);
    this.qualitySampleStartedAt = now;
    this.qualitySampleFrames = 0;
    this.publishTelemetry();
  }

  private updateMovement(deltaSeconds: number) {
    const forwardInput =
      Number(this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) -
      Number(this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown'));
    const strafeInput =
      Number(this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) -
      Number(this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft'));
    if (forwardInput === 0 && strafeInput === 0) {
      this.audio.updateTravelledDistance(0);
      return;
    }

    const input = normalizeMovement({ x: strafeInput, z: forwardInput });
    const distance = MOVE_SPEED * deltaSeconds;
    const delta = {
      x: (-Math.sin(this.yaw) * input.z + Math.cos(this.yaw) * input.x) * distance,
      z: (-Math.cos(this.yaw) * input.z - Math.sin(this.yaw) * input.x) * distance
    };
    const next = resolveMovement(
      { x: this.camera.position.x, z: this.camera.position.z },
      delta,
      this.colliders,
      ROOM_BOUNDS,
      PLAYER_RADIUS
    );
    const travelled = Math.hypot(next.x - this.camera.position.x, next.z - this.camera.position.z);
    this.camera.position.x = next.x;
    this.camera.position.z = next.z;
    this.audio.updateTravelledDistance(travelled);
    if (travelled > 0) this.updateActiveZone();
  }

  private updateActiveZone() {
    const nearestZone = SHOWROOM_ZONES.reduce((nearest, zone) =>
      Math.abs(zone.z - this.camera.position.z) < Math.abs(nearest.z - this.camera.position.z)
        ? zone
        : nearest
    );
    this.setActiveZone(nearestZone.id);
  }

  private setActiveZone(zoneId: string) {
    if (this.activeZoneId === zoneId) return;
    this.activeZoneId = zoneId;
    this.options.onZoneChange?.(zoneId);
  }

  private applyQuality(quality: QualityLevel) {
    this.pipeline.setQuality(quality);
    this.renderer.setPixelRatio(
      Math.min(window.devicePixelRatio || 1, QUALITY_PROFILES[quality].pixelRatio)
    );
    if (quality !== this.quality) {
      this.quality = quality;
      this.options.onQualityChange?.(quality);
    }
    this.publishTelemetry();
  }

  private publishTelemetry() {
    publishExhibitionTelemetry({
      scene: 'hall',
      cameraPose: this.getCameraPose(),
      qualityLevel: this.quality,
      rollingFps: this.rollingFps,
      drawCalls: this.renderer.info?.render?.calls ?? 0,
      triangles: this.renderer.info?.render?.triangles ?? 0,
      textures: this.renderer.info?.memory?.textures ?? 0,
      activePasses: this.pipeline.getActivePassNames?.() ?? [],
      assetSources: { ...this.assetSources },
      visibleZones: ['hall'],
      audioUnlocked: this.audio.isUnlocked(),
      activeCanvasCount: document.querySelectorAll('.exhibition-canvas-host canvas').length
    });
  }

  private reportFatalError(error: unknown) {
    if (this.fatalErrorReported || this.disposed) return;
    this.fatalErrorReported = true;
    this.setInteractionEnabled(false);
    this.options.onFatalError?.(error instanceof Error ? error : new Error(String(error)));
  }
}
