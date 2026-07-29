import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaderSpies = vi.hoisted(() => ({
  dracoDispose: vi.fn(),
  ktxDispose: vi.fn(),
  pmremDispose: vi.fn(),
  renderTargetDispose: vi.fn(),
  setTranscoderPath: vi.fn(),
  gltfLoad: vi.fn(),
  textureDispose: vi.fn(),
  geometryDispose: vi.fn(),
  materialDispose: vi.fn(),
  ktxLoad: vi.fn()
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  return {
    ...actual,
    PMREMGenerator: class {
      compileEquirectangularShader() {}
      fromEquirectangular() {
        return {
          texture: new actual.Texture(),
          dispose: loaderSpies.renderTargetDispose
        };
      }
      dispose = loaderSpies.pmremDispose;
    }
  };
});

vi.mock('three/examples/jsm/loaders/DRACOLoader.js', () => ({
  DRACOLoader: class {
    setDecoderPath() {
      return this;
    }
    dispose = loaderSpies.dracoDispose;
  }
}));

vi.mock('three/examples/jsm/loaders/KTX2Loader.js', async () => {
  const THREE = await import('three');
  return {
    KTX2Loader: class {
      setTranscoderPath(path: string) {
        loaderSpies.setTranscoderPath(path);
        return this;
      }
      detectSupport() {
        return this;
      }
      load(
        _url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress: (event: { loaded: number; total: number }) => void
      ) {
        loaderSpies.ktxLoad(_url);
        onProgress({ loaded: 2, total: 2 });
        onLoad(new THREE.Texture());
      }
      dispose = loaderSpies.ktxDispose;
    }
  };
});

vi.mock('three/examples/jsm/loaders/GLTFLoader.js', async () => {
  const THREE = await import('three');
  return {
    GLTFLoader: class {
      setDRACOLoader() {
        return this;
      }
      setKTX2Loader() {
        return this;
      }
      load(
        url: string,
        onLoad: (gltf: { scene: THREE.Group }) => void,
        onProgress: (event: { loaded: number; total: number }) => void,
        onError: (error: Error) => void
      ) {
        loaderSpies.gltfLoad(url);
        onProgress({ loaded: 4, total: 8 });
        if (url.includes('broken')) onError(new Error('broken model'));
        else {
          const scene = new THREE.Group();
          scene.name = 'source-model';
          const texture = new THREE.Texture();
          texture.dispose = loaderSpies.textureDispose;
          const geometry = new THREE.BoxGeometry();
          geometry.dispose = loaderSpies.geometryDispose;
          const material = new THREE.MeshStandardMaterial({ map: texture });
          material.dispose = loaderSpies.materialDispose;
          scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material));
          onLoad({ scene });
        }
      }
    }
  };
});

vi.mock('three/examples/jsm/loaders/RGBELoader.js', async () => {
  const THREE = await import('three');
  return {
    RGBELoader: class {
      load(
        _url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress: (event: { loaded: number; total: number }) => void
      ) {
        onProgress({ loaded: 3, total: 3 });
        onLoad(new THREE.Texture());
      }
    }
  };
});

vi.mock('three/examples/jsm/loaders/IESLoader.js', async () => {
  const THREE = await import('three');
  return {
    IESLoader: class {
      load(
        _url: string,
        onLoad: (texture: THREE.Texture) => void,
        onProgress: (event: { loaded: number; total: number }) => void
      ) {
        onProgress({ loaded: 4, total: 4 });
        onLoad(new THREE.Texture());
      }
    }
  };
});

import type * as THREE from 'three';
import { ExhibitionAssetLoader } from '../src/exhibition/assets/ExhibitionAssetLoader';
import type { ExhibitionAsset } from '../src/exhibition/assets/exhibitionAssets';

const asset = (id: string, localPath: `/exhibition/${string}`): ExhibitionAsset => ({
  id,
  kind: 'glb',
  localPath,
  sourceUrl: `https://example.test/${id}`,
  author: 'Test author',
  license: 'project-owned',
  files: [{ localPath, byteSize: 1, sha256: 'a'.repeat(64) }]
});

const hdrAsset: ExhibitionAsset = {
  ...asset('hall-hdri', '/exhibition/environment/hall.hdr'),
  kind: 'hdr'
};

const iesAsset: ExhibitionAsset = {
  ...asset('display-ies', '/exhibition/lights/display.ies'),
  kind: 'ies'
};

const audioAsset: ExhibitionAsset = {
  ...asset('hall-ambience', '/exhibition/audio/hall-ambience.wav'),
  kind: 'audio'
};

describe('ExhibitionAssetLoader', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads models, caches their sources, and returns independent clones', async () => {
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, [
      asset('bicycle', '/exhibition/models/bicycle.glb')
    ]);

    const result = await loader.load(() => undefined);
    const first = loader.cloneModel('bicycle');
    const second = loader.cloneModel('bicycle');

    expect(result.models.get('bicycle')?.name).toBe('source-model');
    expect(first).not.toBe(result.models.get('bicycle'));
    expect(second).not.toBe(first);
    expect(loader.cloneModel('missing')).toBeNull();

    await loader.load(() => undefined);
    expect(loaderSpies.gltfLoad).toHaveBeenCalledTimes(1);
    expect(loaderSpies.setTranscoderPath).toHaveBeenCalledWith('/basis/');
  });

  it('reports monotonic progress and isolates individual failures', async () => {
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, [
      asset('bicycle', '/exhibition/models/bicycle.glb'),
      asset('broken', '/exhibition/models/broken.glb')
    ]);
    const progress: number[] = [];

    const result = await loader.load((value) => progress.push(value.loadedBytes));

    expect(result.models.has('bicycle')).toBe(true);
    expect(result.failures.get('broken')?.message).toBe('broken model');
    expect(progress.length).toBeGreaterThan(1);
    expect(progress.every((value, index) => index === 0 || value >= progress[index - 1])).toBe(
      true
    );
  });

  it('loads IES profiles into the texture cache', async () => {
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, [iesAsset]);
    const result = await loader.load(() => undefined);
    expect(result.textures.has('display-ies')).toBe(true);
  });

  it('loads every PBR slot and aggregates progress across all asset kinds', async () => {
    const pbr: ExhibitionAsset = {
      ...asset('stone-pbr', '/exhibition/materials/stone-baseColor.ktx2'),
      kind: 'ktx2',
      files: (['baseColor', 'normal', 'roughness', 'ao'] as const).map((materialSlot) => ({
        localPath: `/exhibition/materials/stone-${materialSlot}.ktx2`,
        byteSize: 2,
        sha256: 'b'.repeat(64),
        materialSlot
      }))
    };
    const successFetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-length': '5' }),
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(5))
    });
    const close = vi.fn();
    vi.stubGlobal('fetch', successFetch);
    vi.stubGlobal(
      'AudioContext',
      class {
        decodeAudioData = vi.fn().mockResolvedValue({});
        close = close;
      }
    );
    const assets = [
      asset('bicycle', '/exhibition/models/bicycle.glb'),
      hdrAsset,
      pbr,
      iesAsset,
      audioAsset
    ];
    const reports: Array<{ loadedBytes: number; totalBytes: number | null }> = [];
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, assets);

    const result = await loader.load((value) => reports.push(value));

    expect(loaderSpies.ktxLoad).toHaveBeenCalledTimes(4);
    expect(
      ['baseColor', 'normal', 'roughness', 'ao'].every((slot) =>
        result.textures.has(`stone-pbr:${slot}`)
      )
    ).toBe(true);
    expect(reports.at(-1)).toMatchObject({ loadedBytes: 24, totalBytes: 28 });
    expect(close).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('isolates HTTP audio failures and always closes the decoder context', async () => {
    const close = vi.fn();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }));
    vi.stubGlobal(
      'AudioContext',
      class {
        decodeAudioData = vi.fn();
        close = close;
      }
    );
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, [audioAsset]);

    const result = await loader.load(() => undefined);

    expect(result.failures.get('hall-ambience')?.message).toContain('404');
    expect(close).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it('disposes shared loaders and cached resources exactly once', async () => {
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, [
      asset('bicycle', '/exhibition/models/bicycle.glb'),
      hdrAsset
    ]);
    await loader.load(() => undefined);

    loader.dispose();
    loader.dispose();

    expect(loaderSpies.dracoDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.ktxDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.pmremDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.renderTargetDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.geometryDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.materialDispose).toHaveBeenCalledTimes(1);
    expect(loaderSpies.textureDispose).toHaveBeenCalledTimes(1);
  });

  it('rejects loading after disposal', async () => {
    const loader = new ExhibitionAssetLoader({} as THREE.WebGLRenderer, []);
    loader.dispose();

    await expect(loader.load(() => undefined)).rejects.toThrow('disposed');
  });
});
