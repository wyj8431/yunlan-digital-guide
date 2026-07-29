import { beforeEach, describe, expect, it, vi } from 'vitest';

const loaderSpies = vi.hoisted(() => ({
  dracoDispose: vi.fn(),
  ktxDispose: vi.fn(),
  pmremDispose: vi.fn(),
  renderTargetDispose: vi.fn()
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
      detectSupport() {
        return this;
      }
      load(_url: string, onLoad: (texture: THREE.Texture) => void) {
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
        onProgress({ loaded: 4, total: 8 });
        if (url.includes('broken')) onError(new Error('broken model'));
        else {
          const scene = new THREE.Group();
          scene.name = 'source-model';
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
      load(_url: string, onLoad: (texture: THREE.Texture) => void) {
        onLoad(new THREE.Texture());
      }
    }
  };
});

vi.mock('three/examples/jsm/loaders/IESLoader.js', async () => {
  const THREE = await import('three');
  return {
    IESLoader: class {
      load(_url: string, onLoad: (texture: THREE.Texture) => void) {
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
  license: 'project-owned'
});

const hdrAsset: ExhibitionAsset = {
  ...asset('hall-hdri', '/exhibition/environment/hall.hdr'),
  kind: 'hdr'
};

const iesAsset: ExhibitionAsset = {
  ...asset('display-ies', '/exhibition/lights/display.ies'),
  kind: 'ies'
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
  });
});
