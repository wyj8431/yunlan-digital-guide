// 嘴型实验室的 Three.js 渲染器，负责模型、动画循环和画质切换。
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { disposeObject3D } from '../../../lib/three/disposeObject3D';
import type { AudioAnalysisFrame } from '../audio/audioSource';
import { nextMouthSignal } from '../audio/mouthSignal';
import { PerformanceMonitor } from '../performance/performanceMonitor';
import { QUALITY_PROFILES } from '../performance/qualityController';
import type { MouthSignalConfig, PerformanceSnapshot, RenderQualityTier } from '../types';
import { createMouthMorphController, type MouthMorphController } from './mouthMorphController';

export type LipSyncRendererOptions = {
  host: HTMLElement;
  modelUrl: string;
  getAudioFrame: () => AudioAnalysisFrame;
  getConfig: () => MouthSignalConfig;
  getQualityTier: () => RenderQualityTier;
  onMetrics: (metrics: PerformanceSnapshot) => void;
  onDebugFrame?: (frame: LipSyncDebugFrame) => void;
  onReady: () => void;
  onError: (message: string) => void;
};

export type LipSyncDebugFrame = {
  currentMouthOpen: number;
  audioStartTimestamp: number | null;
  mouthResponseTimestamp: number | null;
  metrics: PerformanceSnapshot;
};

const MODEL_HEIGHT = 1.82;
const MODEL_FOOT_Y = -0.98;
const RESPONSE_THRESHOLD = 0.01;

function fitModelToStage(model: THREE.Object3D) {
  const bounds = new THREE.Box3().setFromObject(model);
  const center = new THREE.Vector3();
  const size = new THREE.Vector3();

  bounds.getCenter(center);
  bounds.getSize(size);

  const scale = MODEL_HEIGHT / Math.max(size.y, 1);
  model.scale.setScalar(scale);
  model.position.set(-center.x * scale, MODEL_FOOT_Y - bounds.min.y * scale, -center.z * scale);
}

export class LipSyncRenderer {
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly monitor: PerformanceMonitor;
  private readonly loader = new GLTFLoader();
  private readonly visibilityHandler = () => this.handleVisibilityChange();
  private frameId = 0;
  private disposed = false;
  private mouthOpen = 0;
  private lastTimestamp = 0;
  private wasPlaying = false;
  private mouthController: MouthMorphController | null = null;
  private qualityTier: RenderQualityTier;
  private audioStartTimestamp: number | null = null;
  private mouthResponseTimestamp: number | null = null;

  constructor(private readonly options: LipSyncRendererOptions) {
    this.qualityTier = options.getQualityTier();
    this.monitor = new PerformanceMonitor({ qualityTier: this.qualityTier });
    this.camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
    this.camera.position.set(0, 0.18, 5.15);
    this.camera.lookAt(0, -0.05, 0);
    this.renderer = new THREE.WebGLRenderer({
      antialias: window.innerWidth > 860,
      alpha: true
    });
    this.renderer.setClearColor(0x000000, 0);
    this.options.host.appendChild(this.renderer.domElement);
    this.setupScene();
    this.applyQualityTier(this.qualityTier);
    this.resize();
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  async start() {
    try {
      const gltf = await this.loadModel();

      if (this.disposed) {
        return;
      }

      const model = gltf.scene;
      fitModelToStage(model);
      this.scene.add(model);
      this.mouthController = createMouthMorphController(model);
      this.options.onReady();
      this.scheduleFrame();
    } catch {
      if (!this.disposed) {
        this.mouthController?.reset();
        this.options.onError('3D model failed to load.');
      }
    }
  }

  resize() {
    const width = Math.max(this.options.host.clientWidth, 1);
    const height = Math.max(this.options.host.clientHeight, 1);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  dispose() {
    this.disposed = true;
    this.mouthController?.reset();
    window.cancelAnimationFrame(this.frameId);
    document.removeEventListener('visibilitychange', this.visibilityHandler);
    disposeObject3D(this.scene);
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.options.host) {
      this.options.host.removeChild(this.renderer.domElement);
    }
  }

  private setupScene() {
    this.scene.background = null;
    this.scene.add(new THREE.HemisphereLight('#fff3df', '#606c38', 2.2));

    const keyLight = new THREE.DirectionalLight('#ffffff', 2.8);
    keyLight.position.set(2.4, 4.2, 3.2);
    keyLight.castShadow = true;
    this.scene.add(keyLight);

    const floor = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.82, 0.12, 80),
      new THREE.MeshStandardMaterial({ color: '#8b9d83', roughness: 0.82 })
    );
    floor.position.y = -1.04;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  private loadModel() {
    return new Promise<{ scene: THREE.Object3D }>((resolve, reject) => {
      this.loader.load(this.options.modelUrl, resolve, undefined, reject);
    });
  }

  private applyQualityTier(tier: RenderQualityTier) {
    const profile = QUALITY_PROFILES[tier];
    this.qualityTier = tier;
    this.monitor.setQualityTier(tier);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, profile.pixelRatioCap));
    this.renderer.shadowMap.enabled = profile.shadows;
  }

  private scheduleFrame() {
    if (this.disposed || document.hidden) {
      return;
    }

    this.frameId = window.requestAnimationFrame((timestamp) => this.renderFrame(timestamp));
  }

  private renderFrame(timestamp: number) {
    if (this.disposed || document.hidden) {
      this.mouthController?.reset();
      return;
    }

    const nextQuality = this.options.getQualityTier();
    if (nextQuality !== this.qualityTier) {
      this.applyQualityTier(nextQuality);
    }

    const frame = this.options.getAudioFrame();
    const config = this.options.getConfig();
    const deltaMs = this.lastTimestamp > 0 ? timestamp - this.lastTimestamp : 16.7;
    this.lastTimestamp = timestamp;

    if (frame.playing && !this.wasPlaying) {
      this.audioStartTimestamp = null;
      this.mouthResponseTimestamp = null;
    }

    if (frame.playing && frame.rms > config.threshold && this.audioStartTimestamp === null) {
      this.monitor.markAudioStart(timestamp);
      this.audioStartTimestamp = timestamp;
    }

    this.wasPlaying = frame.playing;
    this.mouthOpen = nextMouthSignal(this.mouthOpen, frame.rms, deltaMs, config);
    this.mouthController?.setOpen(this.mouthOpen);

    if (this.mouthOpen > RESPONSE_THRESHOLD && this.mouthResponseTimestamp === null) {
      this.monitor.markMouthResponse(timestamp);
      this.mouthResponseTimestamp = timestamp;
    }

    this.monitor.recordFrame(timestamp);
    this.monitor.setRendererInfo(this.renderer.info);
    const metrics = this.monitor.snapshot();
    this.options.onMetrics(metrics);
    this.options.onDebugFrame?.({
      currentMouthOpen: this.mouthOpen,
      audioStartTimestamp: this.audioStartTimestamp,
      mouthResponseTimestamp: this.mouthResponseTimestamp,
      metrics
    });
    this.renderer.render(this.scene, this.camera);
    this.scheduleFrame();
  }

  private handleVisibilityChange() {
    if (document.hidden) {
      window.cancelAnimationFrame(this.frameId);
      this.mouthController?.reset();
      this.audioStartTimestamp = null;
      this.mouthResponseTimestamp = null;
      return;
    }

    this.lastTimestamp = 0;
    this.scheduleFrame();
  }
}
