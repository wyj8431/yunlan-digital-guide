import * as THREE from 'three';
import { createWuzhenWorld, type WuzhenWorld } from './createWuzhenWorld';
import {
  getDistrict,
  getTour,
  WUZHEN_WEATHER,
  type DistrictId,
  type TourId,
  type WeatherMode
} from './wuzhenConfig';

export type WuzhenRendererOptions = {
  host: HTMLElement;
  onDistrictFocus?: (districtId: DistrictId) => void;
  onWeatherChange?: (mode: WeatherMode) => void;
  onReady?: () => void;
};

const maxPixelRatio = 2;

export class WuzhenRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 200);
  private readonly renderer: THREE.WebGLRenderer;
  private readonly clock = new THREE.Clock();
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly resizeObserver: ResizeObserver;
  private readonly keys = new Set<string>();
  private readonly world: WuzhenWorld;
  private readonly ambientLight = new THREE.HemisphereLight('#d9eced', '#24372e', 1.25);
  private readonly sunLight = new THREE.DirectionalLight('#fff1c9', 2.4);
  private readonly target = new THREE.Vector3();
  private readonly desiredTarget = new THREE.Vector3();
  private readonly desiredCamera = new THREE.Vector3();
  private readonly dragOrigin = new THREE.Vector2();
  private readonly dragPointer = new THREE.Vector2();
  private readonly touchMove = new THREE.Vector2();
  private readonly spherical = new THREE.Spherical();
  private readonly orbitOffset = new THREE.Vector3();
  private readonly onDistrictFocus?: (districtId: DistrictId) => void;
  private readonly onWeatherChange?: (mode: WeatherMode) => void;
  private readonly onReady?: () => void;
  private frameId = 0;
  private activeDistrict: DistrictId = 'overview';
  private dragging = false;
  private disposed = false;
  private tourTimer: number | null = null;
  private tourIndex = 0;
  private tourOrder: DistrictId[] = [];

  constructor({ host, onDistrictFocus, onWeatherChange, onReady }: WuzhenRendererOptions) {
    this.onDistrictFocus = onDistrictFocus;
    this.onWeatherChange = onWeatherChange;
    this.onReady = onReady;
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      preserveDrawingBuffer: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, maxPixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.domElement.className = 'wuzhen-exhibition-canvas';
    this.renderer.domElement.setAttribute('aria-label', '乌镇写实 3D 水乡场景');
    this.renderer.domElement.setAttribute('data-wuzhen-ready', 'false');
    host.appendChild(this.renderer.domElement);

    this.scene.add(this.ambientLight, this.sunLight);
    this.sunLight.position.set(-22, 28, 16);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.set(1024, 1024);
    this.sunLight.shadow.camera.left = -42;
    this.sunLight.shadow.camera.right = 42;
    this.sunLight.shadow.camera.top = 38;
    this.sunLight.shadow.camera.bottom = -38;

    this.world = createWuzhenWorld();
    this.scene.add(this.world.root);
    this.resizeObserver = new ResizeObserver(() => this.resize(host));
    this.resizeObserver.observe(host);

    this.bindEvents();
    this.focusDistrict('overview', false);
    this.setWeather('sun');
    this.resize(host);
    this.frameId = requestAnimationFrame(this.renderFrame);
    this.renderer.domElement.setAttribute('data-wuzhen-ready', 'true');
    this.onReady?.();
  }

  focusDistrict(id: DistrictId, notify = true) {
    const district = getDistrict(id);
    this.activeDistrict = id;
    this.world.setDistrict(id);
    if (id === 'night-river') this.setWeather('night');
    this.desiredCamera.set(...district.camera.position);
    this.desiredTarget.set(...district.camera.target);
    if (notify) this.onDistrictFocus?.(id);
  }

  setWeather(mode: WeatherMode) {
    const setting = WUZHEN_WEATHER[mode];
    this.scene.background = new THREE.Color(setting.sky);
    this.scene.fog = new THREE.Fog(setting.fog, 38, mode === 'night' ? 95 : 118);
    this.ambientLight.intensity = setting.ambientIntensity;
    this.sunLight.color.set(setting.sunColor);
    this.sunLight.intensity = setting.sunIntensity;
    this.world.setWeather(mode);
    this.onWeatherChange?.(mode);
  }

  startTour(tourId: TourId = 'water-street') {
    this.stopTour();
    const { order, intervalMs } = getTour(tourId);
    this.tourOrder = order;
    this.tourIndex = Math.max(order.indexOf(this.activeDistrict), 0);
    this.focusDistrict(order[this.tourIndex]);
    this.tourTimer = window.setInterval(() => {
      this.tourIndex = (this.tourIndex + 1) % this.tourOrder.length;
      this.focusDistrict(this.tourOrder[this.tourIndex]);
    }, intervalMs);
  }

  stopTour() {
    if (this.tourTimer !== null) {
      window.clearInterval(this.tourTimer);
      this.tourTimer = null;
    }
  }

  isTouring() {
    return this.tourTimer !== null;
  }

  setDyeProcess(index: number) {
    this.world.setDyeProcess(index);
  }

  setTouchMove(x: number, z: number) {
    this.touchMove.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(z, -1, 1));
    if (this.touchMove.lengthSq() > 0) this.stopTour();
  }

  async toggleFullscreen() {
    const element = this.renderer.domElement.parentElement;
    if (!element) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await element.requestFullscreen?.();
  }

  saveScreenshot() {
    const link = document.createElement('a');
    link.download = `wuzhen-${this.activeDistrict}-${Date.now()}.png`;
    link.href = this.renderer.domElement.toDataURL('image/png');
    link.click();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    this.stopTour();
    this.resizeObserver.disconnect();
    this.unbindEvents();
    this.scene.traverse((object) => {
      const mesh = object as THREE.Mesh;
      mesh.geometry?.dispose();
      const material = mesh.material;
      if (Array.isArray(material)) {
        material.forEach((item) => item.dispose());
      } else {
        material?.dispose();
      }
    });
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private readonly renderFrame = () => {
    if (this.disposed) return;
    const delta = Math.min(this.clock.getDelta(), 0.05);
    const elapsed = this.clock.elapsedTime;
    this.applyKeyboardPan(delta);
    const smoothing = 1 - Math.exp(-delta * 2.8);
    this.camera.position.lerp(this.desiredCamera, smoothing);
    this.target.lerp(this.desiredTarget, smoothing);
    this.camera.lookAt(this.target);
    this.world.update(elapsed, delta);
    this.renderer.render(this.scene, this.camera);
    this.frameId = requestAnimationFrame(this.renderFrame);
  };

  private bindEvents() {
    const canvas = this.renderer.domElement;
    canvas.addEventListener('pointerdown', this.handlePointerDown);
    canvas.addEventListener('pointermove', this.handlePointerMove);
    canvas.addEventListener('pointerup', this.handlePointerUp);
    canvas.addEventListener('pointercancel', this.handlePointerUp);
    canvas.addEventListener('wheel', this.handleWheel, { passive: false });
    canvas.addEventListener('contextmenu', this.preventContextMenu);
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
  }

  private unbindEvents() {
    const canvas = this.renderer.domElement;
    canvas.removeEventListener('pointerdown', this.handlePointerDown);
    canvas.removeEventListener('pointermove', this.handlePointerMove);
    canvas.removeEventListener('pointerup', this.handlePointerUp);
    canvas.removeEventListener('pointercancel', this.handlePointerUp);
    canvas.removeEventListener('wheel', this.handleWheel);
    canvas.removeEventListener('contextmenu', this.preventContextMenu);
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
  }

  private resize(host: HTMLElement) {
    const width = Math.max(host.clientWidth, 1);
    const height = Math.max(host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private applyKeyboardPan(delta: number) {
    if (this.keys.size === 0 && this.touchMove.lengthSq() === 0) return;
    const direction = new THREE.Vector3();
    this.camera.getWorldDirection(direction);
    direction.y = 0;
    direction.normalize();
    const right = new THREE.Vector3().crossVectors(direction, this.camera.up).normalize();
    const move = new THREE.Vector3();
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) move.add(direction);
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) move.sub(direction);
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) move.sub(right);
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) move.add(right);
    move.addScaledVector(right, this.touchMove.x);
    move.addScaledVector(direction, -this.touchMove.y);
    if (move.lengthSq() === 0) return;
    const speed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight') ? 18 : this.touchMove.lengthSq() > 0 ? 7.2 : 9;
    move.normalize().multiplyScalar(delta * speed);
    this.desiredCamera.add(move);
    this.desiredTarget.add(move);
    this.constrainCameraToDistrict();
  }

  private constrainCameraToDistrict() {
    const bounds = getDistrict(this.activeDistrict).bounds;
    const x = THREE.MathUtils.clamp(this.desiredCamera.x, bounds.minX, bounds.maxX);
    const z = THREE.MathUtils.clamp(this.desiredCamera.z, bounds.minZ, bounds.maxZ);
    this.desiredTarget.x += x - this.desiredCamera.x;
    this.desiredTarget.z += z - this.desiredCamera.z;
    this.desiredCamera.x = x;
    this.desiredCamera.z = z;
  }

  private handlePointerDown = (event: PointerEvent) => {
    this.stopTour();
    this.dragging = true;
    this.dragOrigin.set(event.clientX, event.clientY);
    this.dragPointer.copy(this.dragOrigin);
    this.renderer.domElement.setPointerCapture(event.pointerId);
  };

  private handlePointerMove = (event: PointerEvent) => {
    if (!this.dragging) return;
    const deltaX = event.clientX - this.dragPointer.x;
    const deltaY = event.clientY - this.dragPointer.y;
    this.dragPointer.set(event.clientX, event.clientY);
    if (Math.abs(deltaX) + Math.abs(deltaY) < 0.01) return;
    this.orbit(-deltaX * 0.007, -deltaY * 0.006);
  };

  private handlePointerUp = (event: PointerEvent) => {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.renderer.domElement.hasPointerCapture(event.pointerId)) {
      this.renderer.domElement.releasePointerCapture(event.pointerId);
    }
    const distance = this.dragOrigin.distanceTo(this.dragPointer);
    if (distance < 6) this.pickDistrict(event.clientX, event.clientY);
  };

  private handleWheel = (event: WheelEvent) => {
    event.preventDefault();
    const direction = this.desiredCamera.clone().sub(this.desiredTarget).normalize();
    const distance = THREE.MathUtils.clamp(
      this.desiredCamera.distanceTo(this.desiredTarget) + event.deltaY * 0.035,
      8,
      95
    );
    this.desiredCamera.copy(this.desiredTarget).addScaledVector(direction, distance);
  };

  private preventContextMenu = (event: MouseEvent) => event.preventDefault();

  private handleKeyDown = (event: KeyboardEvent) => {
    if (/^(Key[WASD]|Arrow(Up|Down|Left|Right)|Shift(Left|Right))$/.test(event.code)) {
      event.preventDefault();
      this.keys.add(event.code);
      this.stopTour();
    }
  };

  private handleKeyUp = (event: KeyboardEvent) => this.keys.delete(event.code);

  private orbit(deltaTheta: number, deltaPhi: number) {
    this.orbitOffset.copy(this.desiredCamera).sub(this.desiredTarget);
    this.spherical.setFromVector3(this.orbitOffset);
    this.spherical.theta += deltaTheta;
    this.spherical.phi = THREE.MathUtils.clamp(this.spherical.phi + deltaPhi, 0.18, Math.PI - 0.3);
    this.orbitOffset.setFromSpherical(this.spherical);
    this.desiredCamera.copy(this.desiredTarget).add(this.orbitOffset);
  }

  private pickDistrict(clientX: number, clientY: number) {
    const bounds = this.renderer.domElement.getBoundingClientRect();
    this.pointer.x = ((clientX - bounds.left) / bounds.width) * 2 - 1;
    this.pointer.y = -((clientY - bounds.top) / bounds.height) * 2 + 1;
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hit = this.raycaster.intersectObjects(this.world.hotspots, true).find((intersection) => {
      return typeof intersection.object.userData.districtId === 'string';
    });
    const districtId = hit?.object.userData.districtId as DistrictId | undefined;
    if (districtId) this.focusDistrict(districtId);
  }
}
