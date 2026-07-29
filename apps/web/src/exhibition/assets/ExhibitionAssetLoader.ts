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
  private readonly failures = new Map<string, Error>();
  private readonly pmremTargets: THREE.WebGLRenderTarget[] = [];
  private environment: THREE.Texture | null = null;
  private disposed = false;

  constructor(
    renderer: THREE.WebGLRenderer,
    private readonly assets: ExhibitionAsset[]
  ) {
    this.ktx2 = new KTX2Loader().detectSupport(renderer);
    this.gltf = new GLTFLoader().setDRACOLoader(this.draco).setKTX2Loader(this.ktx2);
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.pmrem.compileEquirectangularShader();
  }

  async load(onProgress: (progress: AssetProgress) => void): Promise<LoadedExhibitionAssets> {
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
        total: this.assets.length
      });
    report();
    await Promise.all(
      this.assets.map(async (asset) => {
        try {
          await this.loadOne(asset, (loaded, total) => {
            loadedByAsset.set(asset.id, Math.max(loadedByAsset.get(asset.id) ?? 0, loaded));
            if (total > 0) totalByAsset.set(asset.id, total);
            report();
          });
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
      failures: this.failures
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
  }

  private loadOne(
    asset: ExhibitionAsset,
    progress: (loaded: number, total: number) => void
  ): Promise<void> {
    const url = asset.localPath;
    if (asset.kind === 'glb')
      return new Promise((resolve, reject) =>
        this.gltf.load(
          url,
          (result) => {
            this.models.set(asset.id, result.scene);
            resolve();
          },
          (event) => progress(event.loaded, event.total),
          reject
        )
      );
    if (asset.kind === 'hdr')
      return new Promise((resolve, reject) =>
        this.rgbe.load(
          url,
          (texture) => {
            const target = this.pmrem.fromEquirectangular(texture);
            this.pmremTargets.push(target);
            texture.dispose();
            this.environment = target.texture;
            resolve();
          },
          undefined,
          reject
        )
      );
    if (asset.kind === 'ktx2')
      return new Promise((resolve, reject) =>
        this.ktx2.load(
          url,
          (texture) => {
            this.textures.set(asset.id, texture);
            resolve();
          },
          undefined,
          reject
        )
      );
    if (asset.kind === 'ies')
      return new Promise((resolve, reject) =>
        this.ies.load(
          url,
          (texture) => {
            this.textures.set(asset.id, texture);
            resolve();
          },
          undefined,
          reject
        )
      );
    if (asset.kind === 'audio')
      return fetch(url)
        .then((response) => response.arrayBuffer())
        .then(async (buffer) => {
          const context = new AudioContext();
          this.audio.set(asset.id, await context.decodeAudioData(buffer));
          await context.close();
        });
    return Promise.resolve();
  }
}
