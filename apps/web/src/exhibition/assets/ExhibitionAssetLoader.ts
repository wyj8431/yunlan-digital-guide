import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { IESLoader } from 'three/examples/jsm/loaders/IESLoader.js';
import type { ExhibitionAsset } from './exhibitionAssets';

export type AssetProgress = {
  loadedBytes: number;
  totalBytes: number | null;
  completed: number;
  total: number;
};

export type LoadedExhibitionAssets = {
  models: Map<string, THREE.Group>;
  textures: Map<string, THREE.Texture>;
  environment: THREE.Texture | null;
  audio: Map<string, AudioBuffer>;
  failures: Map<string, Error>;
};

const ASSET_TIMEOUT_MS = 20_000;

export class ExhibitionAssetLoader {
  private readonly draco = new DRACOLoader().setDecoderPath('/draco/');
  private readonly ktx2: KTX2Loader;
  private readonly gltf: GLTFLoader;
  private readonly rgbe = new RGBELoader();
  private readonly ies = new IESLoader();
  private readonly pmrem: THREE.PMREMGenerator;
  private readonly models = new Map<string, THREE.Group>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly audio = new Map<string, AudioBuffer>();
  private readonly pendingAudio = new Map<string, Promise<void>>();
  private readonly failures = new Map<string, Error>();
  private readonly pmremTargets: THREE.WebGLRenderTarget[] = [];
  private environment: THREE.Texture | null = null;
  private disposed = false;
  private loadPromise: Promise<LoadedExhibitionAssets> | null = null;
  private audioLoadPromise: Promise<Map<string, AudioBuffer>> | null = null;

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly assets: ExhibitionAsset[]
  ) {
    this.ktx2 = new KTX2Loader().setTranscoderPath('/basis/').detectSupport(renderer);
    this.gltf = new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx2);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  async load(onProgress: (progress: AssetProgress) => void): Promise<LoadedExhibitionAssets> {
    if (this.disposed) throw new Error('ExhibitionAssetLoader has been disposed');
    if (this.loadPromise) return this.loadPromise;
    this.loadPromise = this.loadAll(onProgress);
    return this.loadPromise;
  }

  async loadAudio(
    onProgress: (progress: AssetProgress) => void
  ): Promise<Map<string, AudioBuffer>> {
    if (this.disposed) throw new Error('ExhibitionAssetLoader has been disposed');
    if (this.audioLoadPromise) return this.audioLoadPromise;
    const audioAssets = this.assets.filter((asset) => asset.kind === 'audio');
    this.audioLoadPromise = (async () => {
      for (const asset of audioAssets) {
        try {
          await this.loadOne(asset, (_key, loaded, total) =>
            onProgress({
              loadedBytes: loaded,
              totalBytes: total || loaded,
              completed: 0,
              total: audioAssets.length
            })
          );
        } catch (error) {
          this.failures.set(asset.id, error instanceof Error ? error : new Error(String(error)));
        }
      }
      return this.audio;
    })();
    return this.audioLoadPromise;
  }

  private async loadAll(
    onProgress: (progress: AssetProgress) => void
  ): Promise<LoadedExhibitionAssets> {
    const visualAssets = this.assets.filter((asset) => asset.kind !== 'audio');
    const visualAssetIds = new Set(visualAssets.map((asset) => asset.id));
    const loadedByAsset = new Map<string, number>();
    const totalByAsset = new Map<string, number>();
    let completed = 0;
    const report = () =>
      onProgress({
        loadedBytes: [...loadedByAsset.values()].reduce((sum, value) => sum + value, 0),
        totalBytes:
          totalByAsset.size > 0
            ? [...totalByAsset.values()].reduce((sum, value) => sum + value, 0)
            : null,
        completed,
        total: visualAssets.length
      });
    report();
    await Promise.all(
      visualAssets.map(async (asset) => {
        try {
          await this.withTimeout(
            this.loadOne(asset, (key, loaded, total) => {
              loadedByAsset.set(key, Math.max(loadedByAsset.get(key) ?? 0, loaded));
              if (total > 0) totalByAsset.set(key, total);
              report();
            }),
            asset.id
          );
        } catch (error) {
          this.failures.set(asset.id, error instanceof Error ? error : new Error(String(error)));
        } finally {
          completed += 1;
          report();
        }
      })
    );
    return {
      models: this.models,
      textures: this.textures,
      environment: this.environment,
      audio: this.audio,
      failures: new Map([...this.failures].filter(([assetId]) => visualAssetIds.has(assetId)))
    };
  }

  cloneModel(id: string): THREE.Group | null {
    const source = this.models.get(id);
    return source ? (cloneSkeleton(source) as THREE.Group) : null;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    const textures = new Set<THREE.Texture>(this.textures.values());
    this.models.forEach((model) =>
      model.traverse((object) => {
        const mesh = object as THREE.Mesh;
        if (mesh.geometry) geometries.add(mesh.geometry);
        const material = mesh.material;
        (Array.isArray(material) ? material : [material]).forEach((entry) => {
          if (!entry) return;
          Object.values(entry).forEach((value) => {
            if (value instanceof THREE.Texture) textures.add(value);
          });
          materials.add(entry);
        });
      })
    );
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
    if (this.pmremTargets.length === 0) this.environment?.dispose();
    this.pmremTargets.forEach((target) => target.dispose());
    this.pmrem.dispose();
    this.draco.dispose();
    this.ktx2.dispose();
    this.models.clear();
    this.textures.clear();
    this.audio.clear();
    this.pendingAudio.clear();
    this.failures.clear();
    this.loadPromise = null;
    this.audioLoadPromise = null;
  }

  private loadOne(
    asset: ExhibitionAsset,
    progress: (key: string, loaded: number, total: number) => void
  ): Promise<void> {
    const url = asset.localPath;
    if (asset.kind === 'glb')
      return new Promise((resolve, reject) =>
        this.gltf.load(
          url,
          (result) => {
            try {
              this.models.set(asset.id, result.scene);
              resolve();
            } catch (error) {
              reject(error);
            }
          },
          (event) => progress(url, event.loaded, event.total),
          reject
        )
      );
    if (asset.kind === 'hdr')
      return new Promise((resolve, reject) =>
        this.rgbe.load(
          url,
          (texture) => {
            try {
              const target = this.pmrem.fromEquirectangular(texture);
              this.pmremTargets.push(target);
              texture.dispose();
              this.environment = target.texture;
              resolve();
            } catch (error) {
              texture.dispose();
              reject(error);
            }
          },
          (event) => progress(url, event.loaded, event.total),
          reject
        )
      );
    if (asset.kind === 'ktx2')
      return Promise.all(
        asset.files.map(
          (file) =>
            new Promise<void>((resolve, reject) =>
              this.ktx2.load(
                file.localPath,
                (texture) => {
                  try {
                    const slot = file.materialSlot;
                    this.textures.set(slot ? `${asset.id}:${slot}` : asset.id, texture);
                    if (slot === 'baseColor') this.textures.set(asset.id, texture);
                    resolve();
                  } catch (error) {
                    texture.dispose();
                    reject(error);
                  }
                },
                (event) => progress(file.localPath, event.loaded, event.total),
                reject
              )
            )
        )
      ).then(() => undefined);
    if (asset.kind === 'ies')
      return new Promise((resolve, reject) =>
        this.ies.load(
          url,
          (texture) => {
            try {
              this.textures.set(asset.id, texture);
              resolve();
            } catch (error) {
              texture.dispose();
              reject(error);
            }
          },
          (event) => progress(url, event.loaded, event.total),
          reject
        )
      );
    if (asset.kind === 'audio') {
      if (this.audio.has(asset.id)) return Promise.resolve();
      const pending = this.pendingAudio.get(asset.id);
      if (pending) return pending;
      const context = new AudioContext();
      const load = fetch(url)
        .then((response) => {
          if (!response.ok) throw new Error(`Audio request failed with HTTP ${response.status}`);
          const total = Number(response.headers.get('content-length')) || 0;
          return response.arrayBuffer().then((buffer) => {
            progress(url, buffer.byteLength, total || buffer.byteLength);
            return buffer;
          });
        })
        .then(async (buffer) => {
          this.audio.set(asset.id, await context.decodeAudioData(buffer));
        })
        .finally(async () => {
          this.pendingAudio.delete(asset.id);
          await context.close();
        });
      this.pendingAudio.set(asset.id, load);
      return load;
    }
    return Promise.resolve();
  }

  private withTimeout<T>(promise: Promise<T>, assetId: string): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = window.setTimeout(
        () => reject(new Error(`Asset load timed out: ${assetId}`)),
        ASSET_TIMEOUT_MS
      );
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }
}
