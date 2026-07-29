import * as THREE from 'three';

export type ExhibitionSceneAudio = 'hall' | 'lake';

export type ExhibitionAudioMix = {
  master: number;
  ambience: number;
  narration: number;
  footsteps: number;
  water: number;
};

const NARRATION_ASSETS: Record<string, string> = {
  'west-lake-bicycle': 'narration-bicycle',
  'green-mobility-car': 'narration-shuttle',
  'silk-and-tea': 'narration-tea-set',
  'silk-garment': 'narration-silk-garment'
};

const FOOTSTEP_INTERVAL_METRES = 1.35;

export class ExhibitionAudio {
  private readonly context: AudioContext;
  private readonly masterGain: GainNode;
  private readonly ambienceGain: GainNode;
  private readonly narrationGain: GainNode;
  private readonly footstepGain: GainNode;
  private readonly waterGain: GainNode;
  private readonly waterPanner: PannerNode;
  private readonly sources = new Set<AudioBufferSourceNode>();
  private ambienceSource: AudioBufferSourceNode | null = null;
  private waterSource: AudioBufferSourceNode | null = null;
  private narrationSource: AudioBufferSourceNode | null = null;
  private unlockPromise: Promise<void> | null = null;
  private pendingNarrationId: string | null = null;
  private scene: ExhibitionSceneAudio | null = null;
  private unlocked = false;
  private muted = false;
  private disposed = false;
  private travelledSinceStep = 0;
  private mix: ExhibitionAudioMix = {
    master: 1,
    ambience: 1,
    narration: 1,
    footsteps: 0.72,
    water: 0.42
  };

  constructor(
    private readonly listener: THREE.AudioListener,
    private buffers: Map<string, AudioBuffer>
  ) {
    this.context = listener.context;
    this.masterGain = this.context.createGain();
    this.ambienceGain = this.context.createGain();
    this.narrationGain = this.context.createGain();
    this.footstepGain = this.context.createGain();
    this.waterGain = this.context.createGain();
    this.waterPanner = this.context.createPanner();

    this.masterGain.connect(listener.gain);
    this.ambienceGain.connect(this.masterGain);
    this.narrationGain.connect(this.masterGain);
    this.footstepGain.connect(this.masterGain);
    this.waterPanner.connect(this.waterGain);
    this.waterGain.connect(this.masterGain);

    this.waterPanner.distanceModel = 'inverse';
    this.waterPanner.refDistance = 2;
    this.waterPanner.maxDistance = 28;
    this.waterPanner.rolloffFactor = 1.1;
    this.applyMix(0);
  }

  isUnlocked(): boolean {
    return this.unlocked && !this.disposed;
  }

  async unlock(): Promise<void> {
    if (this.disposed || this.unlocked) return;
    if (this.unlockPromise) return this.unlockPromise;
    this.unlockPromise = this.resumeAudio();
    try {
      await this.unlockPromise;
    } finally {
      this.unlockPromise = null;
    }
  }

  setBuffers(buffers: Map<string, AudioBuffer>): void {
    if (this.disposed) return;
    for (const [assetId, buffer] of buffers) this.buffers.set(assetId, buffer);
    if (this.unlocked && this.scene && !this.ambienceSource) this.startSceneAudio();
    if (this.unlocked && this.pendingNarrationId) this.playNarration(this.pendingNarrationId);
  }

  setScene(scene: ExhibitionSceneAudio): void {
    if (this.disposed || this.scene === scene) return;
    this.scene = scene;
    this.travelledSinceStep = 0;
    if (this.unlocked) this.startSceneAudio();
  }

  setMuted(muted: boolean): void {
    if (this.disposed) return;
    this.muted = muted;
    this.mix = { ...this.mix, master: muted ? 0 : 1 };
    this.ramp(this.masterGain.gain, this.mix.master, 0.08);
  }

  getMix(): ExhibitionAudioMix {
    return { ...this.mix };
  }

  setWaterPosition(x: number, y: number, z: number): void {
    if (this.disposed) return;
    this.setParam(this.waterPanner.positionX, x);
    this.setParam(this.waterPanner.positionY, y);
    this.setParam(this.waterPanner.positionZ, z);
  }

  attachTo(camera: THREE.Object3D): void {
    if (this.disposed || !this.unlocked || this.listener.parent === camera) return;
    this.listener.parent?.remove(this.listener);
    camera.add(this.listener);
  }

  detachFrom(camera: THREE.Object3D): void {
    if (this.listener.parent === camera) camera.remove(this.listener);
  }

  playNarration(exhibitId: string): boolean {
    const assetId = NARRATION_ASSETS[exhibitId];
    if (!assetId || this.disposed) return false;
    if (!this.unlocked) {
      this.pendingNarrationId = exhibitId;
      return false;
    }
    const buffer = assetId ? this.buffers.get(assetId) : undefined;
    if (!buffer) {
      this.pendingNarrationId = exhibitId;
      return false;
    }

    this.stopNarration();
    this.pendingNarrationId = null;
    this.mix = { ...this.mix, ambience: 0.35 };
    this.ramp(this.ambienceGain.gain, this.mix.ambience, 0.2);
    const source = this.createSource(buffer, this.narrationGain, false, () => {
      if (this.narrationSource !== source) return;
      this.narrationSource = null;
      this.restoreAmbience();
    });
    this.narrationSource = source;
    return true;
  }

  stopNarration(): void {
    this.pendingNarrationId = null;
    if (this.narrationSource) {
      this.stopSource(this.narrationSource);
      this.narrationSource = null;
    }
    this.restoreAmbience();
  }

  updateTravelledDistance(distanceMetres: number): boolean {
    if (!this.unlocked || this.disposed || distanceMetres <= 0) return false;
    this.travelledSinceStep += distanceMetres;
    if (this.travelledSinceStep < FOOTSTEP_INTERVAL_METRES) return false;
    this.travelledSinceStep %= FOOTSTEP_INTERVAL_METRES;
    const buffer = this.buffers.get('footstep-stone');
    if (!buffer) return false;
    this.createSource(buffer, this.footstepGain, false);
    return true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.unlocked = false;
    this.pendingNarrationId = null;
    this.listener.parent?.remove(this.listener);
    for (const source of [...this.sources]) this.stopSource(source);
    this.ambienceSource = null;
    this.waterSource = null;
    this.narrationSource = null;
    this.ambienceGain.disconnect();
    this.narrationGain.disconnect();
    this.footstepGain.disconnect();
    this.waterPanner.disconnect();
    this.waterGain.disconnect();
    this.masterGain.disconnect();
    this.listener.gain.disconnect();
  }

  private async resumeAudio(): Promise<void> {
    if (this.context.state !== 'running') await this.context.resume();
    if (this.disposed) return;
    this.unlocked = true;
    this.startSceneAudio();
    if (this.pendingNarrationId) this.playNarration(this.pendingNarrationId);
  }

  private startSceneAudio(): void {
    this.stopSource(this.ambienceSource);
    this.stopSource(this.waterSource);
    this.ambienceSource = null;
    this.waterSource = null;
    if (!this.scene) return;
    const buffer = this.buffers.get(`${this.scene}-ambience`);
    if (!buffer) return;
    this.ambienceSource = this.createSource(buffer, this.ambienceGain, true);
    if (this.scene === 'lake') {
      this.waterSource = this.createSource(buffer, this.waterPanner, true);
    }
  }

  private createSource(
    buffer: AudioBuffer,
    destination: AudioNode,
    loop: boolean,
    onEnded?: () => void
  ): AudioBufferSourceNode {
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = loop;
    source.connect(destination);
    source.onended = () => {
      this.sources.delete(source);
      source.disconnect();
      onEnded?.();
    };
    this.sources.add(source);
    source.start();
    return source;
  }

  private stopSource(source: AudioBufferSourceNode | null): void {
    if (!source || !this.sources.has(source)) return;
    source.onended = null;
    this.sources.delete(source);
    try {
      source.stop();
    } catch {
      // A source that ended between frames is already silent.
    }
    source.disconnect();
  }

  private restoreAmbience(): void {
    if (this.disposed || this.mix.ambience === 1) return;
    this.mix = { ...this.mix, ambience: 1 };
    this.ramp(this.ambienceGain.gain, 1, 0.2);
  }

  private applyMix(durationSeconds: number): void {
    this.ramp(this.masterGain.gain, this.muted ? 0 : this.mix.master, durationSeconds);
    this.ramp(this.ambienceGain.gain, this.mix.ambience, durationSeconds);
    this.ramp(this.narrationGain.gain, this.mix.narration, durationSeconds);
    this.ramp(this.footstepGain.gain, this.mix.footsteps, durationSeconds);
    this.ramp(this.waterGain.gain, this.mix.water, durationSeconds);
  }

  private ramp(param: AudioParam, value: number, durationSeconds: number): void {
    const now = this.context.currentTime;
    param.cancelScheduledValues(now);
    param.setValueAtTime(param.value, now);
    param.linearRampToValueAtTime(value, now + durationSeconds);
  }

  private setParam(param: AudioParam, value: number): void {
    param.setValueAtTime(value, this.context.currentTime);
  }
}

export function createExhibitionAudio(): ExhibitionAudio {
  return new ExhibitionAudio(new THREE.AudioListener(), new Map());
}
