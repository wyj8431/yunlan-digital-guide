import * as THREE from 'three';
import { disposeObject3D } from '../lib/three/disposeObject3D';
import {
  PLAYER_RADIUS,
  ROOM_BOUNDS,
  canMoveTo,
  clampToRoom,
  type Collider,
  type Point2
} from './collision';

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

const COLORS = {
  wall: '#edf0e8',
  ceiling: '#f8f5ec',
  floor: '#70877b',
  darkGreen: '#173f35',
  mint: '#a9d8b8',
  gold: '#c5a35a',
  lake: '#73aeb2',
  ink: '#253632',
  white: '#f8faf5'
};

function boxCollider(x: number, z: number, width: number, depth: number): Collider {
  return {
    minX: x - width / 2,
    maxX: x + width / 2,
    minZ: z - depth / 2,
    maxZ: z + depth / 2
  };
}

function createBox(width: number, height: number, depth: number, color: string, roughness = 0.72) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.08 })
  );
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
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly clock = new THREE.Clock();
  private readonly pressedKeys = new Set<string>();
  private readonly colliders: Collider[] = [];
  private readonly exhibitRoots: THREE.Object3D[] = [];
  private readonly resizeObserver: ResizeObserver;
  private frameId = 0;
  private disposed = false;
  private looking = false;
  private yaw = 0;
  private pitch = 0;

  private readonly handleKeyDown = (event: KeyboardEvent) => {
    if (event.code.startsWith('Key') || event.code.startsWith('Arrow')) {
      this.pressedKeys.add(event.code);
    }
  };

  private readonly handleKeyUp = (event: KeyboardEvent) => {
    this.pressedKeys.delete(event.code);
  };

  private readonly handlePointerDown = () => {
    this.looking = true;
    this.renderer.domElement.requestPointerLock?.();
  };

  private readonly handlePointerUp = () => {
    this.looking = false;
  };

  private readonly handlePointerMove = (event: PointerEvent) => {
    if (!this.looking && document.pointerLockElement !== this.renderer.domElement) return;

    this.yaw -= event.movementX * LOOK_SENSITIVITY;
    this.pitch = THREE.MathUtils.clamp(
      this.pitch - event.movementY * LOOK_SENSITIVITY,
      -MAX_PITCH,
      MAX_PITCH
    );
    this.applyCameraRotation();
  };

  private readonly handleClick = (event: MouseEvent) => {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    if (bounds.width <= 0 || bounds.height <= 0) return;

    this.pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const intersections = this.raycaster.intersectObjects(this.exhibitRoots, true);

    for (const intersection of intersections) {
      let object: THREE.Object3D | null = intersection.object;
      while (object) {
        const exhibitId = object.userData.exhibitId;
        if (typeof exhibitId === 'string') {
          this.options.onExhibitSelect(exhibitId);
          return;
        }
        object = object.parent;
      }
    }
  };

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
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('click', this.handleClick);
    disposeObject3D(this.scene);
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
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
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

    const floor = createBox(16, 0.18, 20, COLORS.floor, 0.88);
    floor.position.set(0, -0.09, 0);
    floor.receiveShadow = true;
    shell.add(floor);

    const ceiling = createBox(16, 0.16, 20, COLORS.ceiling, 0.95);
    ceiling.position.set(0, 4.72, 0);
    shell.add(ceiling);

    const backWall = createBox(16, 4.8, 0.18, COLORS.wall);
    backWall.position.set(0, 2.4, -10);
    const leftWall = createBox(0.18, 4.8, 20, COLORS.wall);
    leftWall.position.set(-8, 2.4, 0);
    const rightWall = createBox(0.18, 4.8, 20, COLORS.wall);
    rightWall.position.set(8, 2.4, 0);
    const entryHeader = createBox(16, 0.65, 0.18, COLORS.darkGreen);
    entryHeader.position.set(0, 4.35, 10);
    shell.add(backWall, leftWall, rightWall, entryHeader);

    const lakeRibbon = createBox(11, 0.035, 1.4, COLORS.lake, 0.25);
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

    const mapTable = this.createDisplayTable('west-lake-map', -3.8, -1.2, 2.8, 1.7);
    const craftTable = this.createDisplayTable('silk-and-tea', 3.8, -1.2, 2.5, 1.5);
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
    this.colliders.push(boxCollider(x, z, width, depth));
    return table;
  }

  private createWallArt() {
    const art = new THREE.Group();
    art.position.set(0, 2.45, -9.82);
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
    bicycle.position.set(-4.3, 0.72, -5.6);
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
    this.colliders.push(boxCollider(-4.3, -5.6, 2.5, 1.2));
    return bicycle;
  }

  private createCar() {
    const car = new THREE.Group();
    car.position.set(3.6, 0, -5.6);
    const body = createBox(3.3, 0.68, 1.45, '#497c68', 0.28);
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
    this.colliders.push(boxCollider(3.6, -5.6, 3.7, 1.9));
    return car;
  }

  private createGreenery() {
    const greenery = new THREE.Group();
    greenery.name = 'greenery';
    for (const [x, z] of [
      [-6.7, -8.4],
      [6.7, -8.4],
      [-6.7, 7.8],
      [6.7, 7.8]
    ] as Array<[number, number]>) {
      const planter = createBox(0.9, 0.58, 0.9, COLORS.gold, 0.8);
      planter.position.set(x, 0.29, z);
      const stem = createBox(0.12, 1.15, 0.12, COLORS.darkGreen);
      stem.position.set(x, 1.1, z);
      const crown = new THREE.Mesh(
        new THREE.SphereGeometry(0.72, 12, 8),
        new THREE.MeshStandardMaterial({ color: '#5e9870', roughness: 0.9 })
      );
      crown.position.set(x, 1.75, z);
      crown.castShadow = true;
      greenery.add(planter, stem, crown);
      this.colliders.push(boxCollider(x, z, 1.05, 1.05));
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
    this.updateMovement(Math.min(this.clock.getDelta(), 0.05));
    this.renderer.render(this.scene, this.camera);
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

    const magnitude = Math.hypot(forwardInput, strafeInput) || 1;
    const distance = (MOVE_SPEED * deltaSeconds) / magnitude;
    const delta = {
      x: (-Math.sin(this.yaw) * forwardInput + Math.cos(this.yaw) * strafeInput) * distance,
      z: (-Math.cos(this.yaw) * forwardInput - Math.sin(this.yaw) * strafeInput) * distance
    };
    const current: Point2 = { x: this.camera.position.x, z: this.camera.position.z };

    if (canMoveTo(current, { x: delta.x, z: 0 }, this.colliders, PLAYER_RADIUS)) {
      const next = clampToRoom(
        { x: current.x + delta.x, z: current.z },
        ROOM_BOUNDS,
        PLAYER_RADIUS
      );
      this.camera.position.x = next.x;
      current.x = next.x;
    }
    if (canMoveTo(current, { x: 0, z: delta.z }, this.colliders, PLAYER_RADIUS)) {
      const next = clampToRoom(
        { x: current.x, z: current.z + delta.z },
        ROOM_BOUNDS,
        PLAYER_RADIUS
      );
      this.camera.position.z = next.z;
    }
  }
}
