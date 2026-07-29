import * as THREE from 'three';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import {
  PLAYER_RADIUS,
  clampFrameDelta,
  normalizeMovement,
  resolveMovement,
  type Collider,
  type Point2
} from './collision';

type WestLakeSceneOptions = { host: HTMLElement };

const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 3.2;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI * 0.45;

export const LAKE_BOUNDS: Collider = { minX: -10, maxX: 10, minZ: -8, maxZ: 9 };
const WATER_COLLIDERS: Collider[] = [
  { minX: -8.5, maxX: -0.9, minZ: -5, maxZ: 5 },
  { minX: 0.9, maxX: 8.5, minZ: -5, maxZ: 5 }
];

function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, name?: string): THREE.Mesh {
  const result = new THREE.Mesh(geometry, material);
  if (name) result.name = name;
  result.castShadow = true;
  result.receiveShadow = true;
  return result;
}

export function createWestLakeModel(): THREE.Group {
  const model = new THREE.Group();
  model.name = 'west-lake-landscape';

  const lake = new THREE.Group();
  lake.name = 'lake-water';
  const water = mesh(
    new THREE.PlaneGeometry(17, 11),
    new THREE.MeshPhysicalMaterial({
      color: '#58a7ad',
      roughness: 0.24,
      transparent: true,
      opacity: 0.82,
      metalness: 0.06
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.04;
  lake.add(water);

  const causeway = new THREE.Group();
  causeway.name = 'su-causeway';
  const causewayDeck = mesh(
    new THREE.BoxGeometry(1.8, 0.24, 14),
    new THREE.MeshStandardMaterial({ color: '#d7c89a', roughness: 0.86 })
  );
  causewayDeck.position.y = 0.12;
  causeway.add(causewayDeck);

  const bridge = new THREE.Group();
  bridge.name = 'arch-bridge';
  const stone = new THREE.MeshStandardMaterial({ color: '#e5dfca', roughness: 0.88 });
  const bridgeDeck = mesh(new THREE.BoxGeometry(1.8, 0.24, 2.6), stone);
  bridgeDeck.position.y = 0.34;
  bridge.add(bridgeDeck);
  for (const x of [-0.78, 0.78]) {
    for (const z of [-1.1, -0.55, 0, 0.55, 1.1]) {
      const rail = mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), stone);
      rail.position.set(x, 0.65, z);
      bridge.add(rail);
    }
  }

  const trees = new THREE.Group();
  trees.name = 'trees';
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: '#594334', roughness: 0.9 });
  const leafMaterial = new THREE.MeshStandardMaterial({ color: '#4f8767', roughness: 0.88 });
  for (const z of [-5.6, -3.8, -2, 2, 3.8, 5.6]) {
    for (const x of [-1.35, 1.35]) {
      const tree = new THREE.Group();
      const trunk = mesh(new THREE.CylinderGeometry(0.09, 0.13, 1.2, 8), trunkMaterial);
      trunk.position.y = 0.72;
      const crown = mesh(new THREE.SphereGeometry(0.48, 10, 8), leafMaterial);
      crown.position.y = 1.48;
      tree.position.set(x, 0, z);
      tree.add(trunk, crown);
      trees.add(tree);
    }
  }

  const pagoda = new THREE.Group();
  pagoda.name = 'leifeng-pagoda';
  const pagodaBody = new THREE.MeshStandardMaterial({ color: '#a97243', roughness: 0.74 });
  const pagodaRoof = new THREE.MeshStandardMaterial({ color: '#344f42', roughness: 0.7 });
  for (let level = 0; level < 5; level += 1) {
    const body = mesh(
      new THREE.CylinderGeometry(0.42 - level * 0.045, 0.52 - level * 0.04, 0.48, 8),
      pagodaBody
    );
    body.position.y = 0.48 + level * 0.52;
    const roof = mesh(new THREE.CylinderGeometry(0.04, 0.7 - level * 0.06, 0.16, 8), pagodaRoof);
    roof.position.y = 0.78 + level * 0.52;
    pagoda.add(body, roof);
  }
  pagoda.position.set(5.7, 0, -4.8);

  const mountains = new THREE.Group();
  mountains.name = 'distant-mountains';
  const mountainMaterial = new THREE.MeshStandardMaterial({ color: '#68836f', roughness: 0.96 });
  for (const [x, z, radius, height] of [
    [-6.5, -6.4, 2.7, 3.5],
    [0, -7.2, 3.4, 4.2],
    [6.2, -6.6, 2.9, 3.8]
  ] as const) {
    const mountain = mesh(new THREE.ConeGeometry(radius, height, 12), mountainMaterial);
    mountain.position.set(x, height / 2 - 0.1, z);
    mountains.add(mountain);
  }

  model.add(lake, causeway, bridge, trees, pagoda, mountains);
  return model;
}

export function resolveLakeMovement(point: Point2, delta: Point2): Point2 {
  return resolveMovement(point, delta, WATER_COLLIDERS, LAKE_BOUNDS, PLAYER_RADIUS);
}

export class WestLakeScene {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(68, 1, 0.08, 100);
  private readonly renderer: THREE.WebGLRenderer;
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
  };

  constructor(private readonly options: WestLakeSceneOptions) {
    this.scene.background = new THREE.Color('#c9dfd8');
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
    this.options.host.appendChild(this.renderer.domElement);
    this.scene.add(new THREE.HemisphereLight('#fffbea', '#315c50', 2.6));
    const sun = new THREE.DirectionalLight('#fff4d6', 2.2);
    sun.position.set(4, 8, 5);
    sun.castShadow = true;
    this.scene.add(sun, createWestLakeModel());
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
    disposeObject3D(this.scene);
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
    this.updateMovement(clampFrameDelta(this.clock.getDelta()));
    if (!this.reducedMotion) {
      const water = this.scene.getObjectByName('lake-water');
      if (water) water.position.y = Math.sin(performance.now() * 0.0008) * 0.015;
    }
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.render);
  };
}
