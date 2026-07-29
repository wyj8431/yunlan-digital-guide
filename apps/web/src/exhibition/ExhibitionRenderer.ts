import * as THREE from 'three';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import {
  PLAYER_RADIUS,
  ROOM_BOUNDS,
  clampFrameDelta,
  normalizeMovement,
  resolveMovement,
  type Collider
} from './collision';
import { EXHIBITION_LAYOUT, HALL_DIMENSIONS, findExhibitLayout } from './exhibitionLayout';
import {
  EXHIBITION_COLORS as COLORS,
  createHallMaterials,
  type HallMaterials
} from './exhibitionMaterials';
import { PostProcessingPipeline } from './quality/PostProcessingPipeline';

export type ExhibitionRendererOptions = {
  host: HTMLElement;
  onExhibitSelect: (exhibitId: string) => void;
};

export type ExhibitionCameraPose = {
  position: { x: number; y: number; z: number };
  yaw: number;
  pitch: number;
};

const EYE_HEIGHT = 1.65;
const MOVE_SPEED = 3.2;
const LOOK_SENSITIVITY = 0.0022;
const MAX_PITCH = Math.PI * 0.45;

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
  private readonly pipeline: PostProcessingPipeline;
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly pressedKeys = new Set<string>();
  private readonly colliders: Collider[] = EXHIBITION_LAYOUT.flatMap((item) =>
    item.blocksMovement && item.collider ? [item.collider] : []
  );
  private readonly exhibitRoots: THREE.Object3D[] = [];
  private readonly materials: HallMaterials = createHallMaterials();
  private readonly resizeObserver: ResizeObserver;
  private frameId = 0;
  private disposed = false;
  private looking = false;
  private interactionEnabled = true;
  private yaw = 0;
  private pitch = 0;

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
    if (exhibitId) this.options.onExhibitSelect(exhibitId);
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
    this.scene.background = new THREE.Color('#dfe6df');
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

    this.setupHall();
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
    this.scene.add(this.createHallShell());
    this.scene.add(this.createLighting());
    this.scene.add(this.createExhibits());
    this.scene.add(this.createGreenery());
  }

  private createHallShell() {
    const shell = new THREE.Group();
    shell.name = 'hall-shell';

    const floor = createBox(
      HALL_DIMENSIONS.width,
      0.18,
      HALL_DIMENSIONS.depth,
      this.materials.floor
    );
    floor.position.set(0, -0.09, 0);
    floor.receiveShadow = true;
    shell.add(floor);

    const ceiling = createBox(
      HALL_DIMENSIONS.width,
      0.16,
      HALL_DIMENSIONS.depth,
      this.materials.ceiling
    );
    ceiling.position.set(0, HALL_DIMENSIONS.height - 0.08, 0);
    shell.add(ceiling);

    const backWall = createBox(
      HALL_DIMENSIONS.width,
      HALL_DIMENSIONS.height,
      0.18,
      this.materials.wall
    );
    backWall.position.set(0, HALL_DIMENSIONS.height / 2, -HALL_DIMENSIONS.depth / 2);
    const leftWall = createBox(
      0.18,
      HALL_DIMENSIONS.height,
      HALL_DIMENSIONS.depth,
      this.materials.wall
    );
    leftWall.position.set(-HALL_DIMENSIONS.width / 2, HALL_DIMENSIONS.height / 2, 0);
    const rightWall = createBox(
      0.18,
      HALL_DIMENSIONS.height,
      HALL_DIMENSIONS.depth,
      this.materials.wall
    );
    rightWall.position.set(HALL_DIMENSIONS.width / 2, HALL_DIMENSIONS.height / 2, 0);
    const entryHeader = createBox(HALL_DIMENSIONS.width, 0.65, 0.18, this.materials.metal);
    entryHeader.position.set(0, 4.35, 10);
    shell.add(backWall, leftWall, rightWall, entryHeader);

    const lakeRibbon = createBox(11, 0.035, 1.4, this.materials.water);
    lakeRibbon.position.set(0, 0.02, -7.7);
    shell.add(lakeRibbon);
    return shell;
  }

  private createLighting() {
    const lighting = new THREE.Group();
    lighting.name = 'hall-lighting';
    lighting.add(new THREE.HemisphereLight('#fff9e8', '#234b42', 2.1));
    lighting.add(new THREE.AmbientLight('#d8eadf', 0.85));

    const sun = new THREE.DirectionalLight('#fff4d6', 2.4);
    sun.position.set(4, 7, 5);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    lighting.add(sun);

    for (const x of [-5, 0, 5]) {
      const pendant = new THREE.PointLight('#ffe4a3', 15, 8, 2);
      pendant.position.set(x, 4.15, -1.5);
      const shade = new THREE.Mesh(
        new THREE.CylinderGeometry(0.26, 0.48, 0.32, 16, 1, true),
        new THREE.MeshStandardMaterial({ color: COLORS.gold, roughness: 0.42 })
      );
      shade.position.set(x, 4.18, -1.5);
      lighting.add(pendant, shade);
    }
    return lighting;
  }

  private createExhibits() {
    const exhibits = new THREE.Group();
    exhibits.name = 'exhibits';

    const mapLayout = findExhibitLayout('west-lake-map');
    const craftLayout = findExhibitLayout('silk-and-tea');
    const mapTable = this.createDisplayTable(
      mapLayout.id,
      mapLayout.position.x,
      mapLayout.position.z,
      mapLayout.size.width,
      mapLayout.size.depth
    );
    const craftTable = this.createDisplayTable(
      craftLayout.id,
      craftLayout.position.x,
      craftLayout.position.z,
      craftLayout.size.width,
      craftLayout.size.depth
    );
    const bicycle = this.createBicycle();
    const car = this.createCar();
    const wallArt = this.createWallArt();
    exhibits.add(mapTable, craftTable, bicycle, car, wallArt);
    return exhibits;
  }

  private createDisplayTable(
    exhibitId: string,
    x: number,
    z: number,
    width: number,
    depth: number
  ) {
    const table = new THREE.Group();
    table.position.set(x, 0, z);
    const base = createBox(width, 0.72, depth, COLORS.darkGreen);
    base.position.y = 0.36;
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(width * 0.88, 0.14, depth * 0.84),
      new THREE.MeshPhysicalMaterial({
        color: COLORS.mint,
        transparent: true,
        opacity: 0.62,
        roughness: 0.15,
        transmission: 0.2
      })
    );
    glass.position.y = 0.82;
    table.add(base, glass);
    markExhibit(table, exhibitId);
    this.exhibitRoots.push(table);
    return table;
  }

  private createWallArt() {
    const art = new THREE.Group();
    const layout = findExhibitLayout('west-lake-wall-art');
    art.position.set(layout.position.x, layout.position.y, layout.position.z);
    const frame = createBox(6.6, 2.5, 0.12, COLORS.gold, 0.4);
    const canvas = createBox(6.22, 2.12, 0.08, COLORS.white, 0.92);
    canvas.position.z = 0.09;
    const lake = createBox(4.8, 0.32, 0.05, COLORS.lake, 0.35);
    lake.position.set(0, -0.25, 0.16);
    const skyline = createBox(2.7, 0.08, 0.06, COLORS.ink, 0.75);
    skyline.position.set(-0.6, 0.48, 0.17);
    art.add(frame, canvas, lake, skyline);
    markExhibit(art, 'west-lake-wall-art');
    this.exhibitRoots.push(art);
    return art;
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

  private createGreenery() {
    const greenery = new THREE.Group();
    greenery.name = 'greenery';
    for (const item of EXHIBITION_LAYOUT.filter((candidate) => candidate.kind === 'plant')) {
      const { x, z } = item.position;
      const planter = createBox(0.9, 0.58, 0.9, COLORS.gold, 0.8);
      planter.position.set(x, 0.29, z);
      const stem = createBox(0.12, 1.15, 0.12, COLORS.darkGreen);
      stem.position.set(x, 1.1, z);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 12, 8),
        new THREE.MeshStandardMaterial({ color: COLORS.foliage, roughness: 0.9 })
      );
      crown.position.set(x, 1.75, z);
      crown.castShadow = true;
      greenery.add(planter, stem, crown);
    }
    return greenery;
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
    this.pipeline.render(deltaSeconds);
    this.scheduleFrame();
  }

  private updateMovement(deltaSeconds: number) {
    const forwardInput =
      Number(this.pressedKeys.has('KeyW') || this.pressedKeys.has('ArrowUp')) -
      Number(this.pressedKeys.has('KeyS') || this.pressedKeys.has('ArrowDown'));
    const strafeInput =
      Number(this.pressedKeys.has('KeyD') || this.pressedKeys.has('ArrowRight')) -
      Number(this.pressedKeys.has('KeyA') || this.pressedKeys.has('ArrowLeft'));
    if (forwardInput === 0 && strafeInput === 0) return;

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
    this.camera.position.x = next.x;
    this.camera.position.z = next.z;
  }
}
