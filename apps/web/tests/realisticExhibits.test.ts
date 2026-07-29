import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { LoadedExhibitionAssets } from '../src/exhibition/assets/ExhibitionAssetLoader';
import { EXHIBITION_LAYOUT } from '../src/exhibition/exhibitionLayout';
import { createRealisticExhibits } from '../src/exhibition/scene/createRealisticExhibits';

function createModel(color: string) {
  const root = new THREE.Group();
  root.add(
    new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1), new THREE.MeshStandardMaterial({ color }))
  );
  return root;
}

function createAssets(missingId?: string): LoadedExhibitionAssets {
  const models = new Map<string, THREE.Group>();
  for (const [id, color] of [
    ['bicycle', '#bc9b50'],
    ['shuttle', '#173f38'],
    ['tea-set', '#e8e0cf'],
    ['silk-garment', '#8f2838']
  ] as const) {
    if (id !== missingId) models.set(id, createModel(color));
  }
  return {
    models,
    textures: new Map(),
    environment: null,
    audio: new Map(),
    failures: new Map()
  };
}

describe('realistic exhibition models', () => {
  it('creates four stable GLB-backed roots with two LOD levels', () => {
    const result = createRealisticExhibits(createAssets(), EXHIBITION_LAYOUT);

    expect([...result.roots.keys()]).toEqual([
      'west-lake-bicycle',
      'green-mobility-car',
      'silk-and-tea',
      'silk-garment'
    ]);
    expect([...result.roots.values()].every((root) => root.userData.assetSource === 'glb')).toBe(
      true
    );
    expect(result.lods.every((lod) => lod.levels.length >= 2)).toBe(true);
  });

  it('normalizes models onto their display surfaces and propagates clickable IDs', () => {
    const result = createRealisticExhibits(createAssets(), EXHIBITION_LAYOUT);

    for (const [exhibitId, root] of result.roots) {
      root.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(root);
      expect(bounds.min.y).toBeGreaterThanOrEqual(0.61);
      expect(bounds.max.y).toBeLessThanOrEqual(2.65);
      root.traverse((object) => expect(object.userData.exhibitId).toBe(exhibitId));
    }
  });

  it('enables shadows only for opaque hero meshes', () => {
    const assets = createAssets();
    const tea = assets.models.get('tea-set')!;
    const glass = tea.children[0] as THREE.Mesh;
    glass.material = new THREE.MeshPhysicalMaterial({ transmission: 1, transparent: true });

    const result = createRealisticExhibits(assets, EXHIBITION_LAYOUT);
    const teaRoot = result.roots.get('silk-and-tea')!;
    const meshes: THREE.Mesh[] = [];
    teaRoot.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) meshes.push(object as THREE.Mesh);
    });

    expect(meshes.some((mesh) => mesh.castShadow === false)).toBe(true);
    expect(
      [...result.roots.values()].some((root) => {
        let casts = false;
        root.traverse((object) => {
          if ((object as THREE.Mesh).isMesh && (object as THREE.Mesh).castShadow) casts = true;
        });
        return casts;
      })
    ).toBe(true);
  });

  it('uses a correctly identified fallback when one GLB is unavailable', () => {
    const result = createRealisticExhibits(createAssets('shuttle'), EXHIBITION_LAYOUT);

    expect(result.roots.get('green-mobility-car')?.userData.assetSource).toBe('fallback');
    expect(result.failures).toEqual(['green-mobility-car']);
    expect(result.roots.get('green-mobility-car')?.userData.exhibitId).toBe('green-mobility-car');
  });
});
