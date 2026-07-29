import * as THREE from 'three';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import type { LoadedExhibitionAssets } from './assets/ExhibitionAssetLoader';
import {
  PLAYER_RADIUS,
  clampFrameDelta,
  normalizeMovement,
  resolveMovement,
  type Collider,
  type Point2
} from './collision';
import { PostProcessingPipeline } from './quality/PostProcessingPipeline';
import { QUALITY_PROFILES, QualityDowngradeController } from './quality/qualityProfile';
import { WEST_LAKE_COLLIDERS, createWestLakeEnvironment } from './scene/createWestLakeEnvironment';

type WestLakeSceneOptions = { host: HTMLElement };

const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 3.2;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI * 0.45;

export const LAKE_BOUNDS: Collider = { minX: -10, maxX: 10, minZ: -8, maxZ: 9 };

const EMPTY_ASSETS: LoadedExhibitionAssets = {
  models: new Map(),
  textures: new Map(),
  environment: null,
  audio: new Map(),
  failures: new Map()
};

export function resolveLakeMovement(point: Point2, delta: Point2): Point2 {
  return resolveMovement(point, delta, WEST_LAKE_COLLIDERS, LAKE_BOUNDS, PLAYER_RADIUS);
}

export class WestLakeScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 100);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly environment = createWestLakeEnvironment(EMPTY_ASSETS, QUALITY_PROFILES.high);
  private readonly pipeline: PostProcessingPipeline;
  private readonly observer: ResizeObserver;
  private readonly clock = new THREE.Clock();
  private readonly pressedKeys = new Set<string>();
  private readonly motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private frameId = 0;
  private disposed = false;
  private looking = false;
  private yaw = 0;
  private pitch = 0;
  private reducedMotion = this.motionQuery.matches;
  private readonly qualityController = new QualityDowngradeController(
    'high',
    45,
    20_000,
    5_000,
    performance.now()
  );
  private qualitySampleStartedAt = performance.now();
  private qualitySampleFrames = 0;

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow'))
      this.pressedKeys.add(event.code);
  };
  private readonly handleKeyUp = (event: KeyboardEvent) => this.pressedKeys.delete(event.code);
  private readonly handleBlur = () => {
    this.pressedKeys.clear();
    this.looking = false;
  };
  private readonly handlePointerDown = () => {
    this.looking = true;
    this.renderer.domElement.requestPointerLock?.();
  };
  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.looking && document.pointerLockElement !== this.renderer.domElement) return;
    this.yaw -= event.movementX * LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
    this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
  };
  private readonly handleMotionChange = (event: MediaQueryListEvent) => {
    this.reducedMotion = event.matches;
    this.environment.setReducedMotion(event.matches);
  };

  constructor(private readonly options: WestLakeSceneOptions) {
    this.scene.background = new THREE.Color('#a9c4bc');
    this.camera.position.set(0, EYE_HEIGHT, 7.5);
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
    this.renderer.toneMappingExposure = 0.9;
    this.options.host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#fffbea', '#315c50', 0.92));
    const sun = new THREE.DirectionalLight('#fff4d6', 1.05);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    this.scene.add(sun, this.environment.root);
    this.scene.fog = new THREE.FogExp2('#a9c4bc', 0.011);
    this.environment.setReducedMotion(this.reducedMotion);
    this.pipeline = new PostProcessingPipeline({
      renderer: this.renderer,
      scene: this.scene,
      camera: this.camera,
      reducedMotion: this.reducedMotion
    });
    this.attachListeners();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(options.host);
    this.resize();
    this.render();
  }

  getCameraPose() {
    return {
      position: { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z },
      yaw: this.yaw,
      pitch: this.pitch
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.observer.disconnect();
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    window.removeEventListener('blur', this.handleBlur);
    window.removeEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.motionQuery.removeEventListener('change', this.handleMotionChange);
    this.environment.dispose();
    this.scene.remove(this.environment.root);
    disposeObject3D(this.scene);
    this.pipeline.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }

  private attachListeners() {
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    window.addEventListener('blur', this.handleBlur);
    window.addEventListener('pointermove', this.handlePointerMove);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.motionQuery.addEventListener('change', this.handleMotionChange);
  }

  private resize() {
    if (this.disposed) return;
    const width = Math.max(this.options.host.clientWidth, 1);
    const height = Math.max(this.options.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.pipeline.resize(width, height, window.devicePixelRatio || 1);
  }

  private updateMovement(deltaSeconds: number) {
    const forward =
      Number(this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) -
      Number(this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown'));
    const strafe =
      Number(this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) -
      Number(this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft'));
    const input = normalizeMovement({ x: strafe, z: forward });
    const distance = MOVE_SPEED * deltaSeconds;
    const next = resolveLakeMovement(
      { x: this.camera.position.x, z: this.camera.position.z },
      {
        x: (-Math.sin(this.yaw) * input.z + Math.cos(this.yaw) * input.x) * distance,
        z: (-Math.cos(this.yaw) * input.z - Math.sin(this.yaw) * input.x) * distance
      }
    );
    this.camera.position.x = next.x;
    this.camera.position.z = next.z;
  }

  private render = () => {
    if (this.disposed) return;
    const deltaSeconds = clampFrameDelta(this.clock.getDelta());
    this.updateMovement(deltaSeconds);
    this.updateZoneVisibility();
    this.environment.update(deltaSeconds);
    this.sampleQuality();
    this.pipeline.render(deltaSeconds);
    this.frameId = requestAnimationFrame(this.render);
  };

  private sampleQuality() {
    this.qualitySampleFrames += 1;
    const now = performance.now();
    const elapsed = now - this.qualitySampleStartedAt;
    if (elapsed < 1_000) return;
    const fps = (this.qualitySampleFrames * 1_000) / elapsed;
    this.pipeline.setQuality(this.qualityController.sample(fps, now));
    this.qualitySampleStartedAt = now;
    this.qualitySampleFrames = 0;
  }

  private updateZoneVisibility() {
    const distanceVisible = this.camera.position.z > -6.5;
    const shorelineVisible = Math.abs(this.camera.position.z) < 8.2;
    this.environment.setZoneVisible('lake', true);
    this.environment.setZoneVisible('shore', shorelineVisible);
    this.environment.setZoneVisible('vegetation', shorelineVisible);
    this.environment.setZoneVisible('distance', distanceVisible);
  }
}
