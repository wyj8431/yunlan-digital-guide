import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import type { LoadedExhibitionAssets } from '../src/exhibition/assets/ExhibitionAssetLoader';
import { QUALITY_PROFILES } from '../src/exhibition/quality/qualityProfile';
import { createWestLakeEnvironment } from '../src/exhibition/scene/createWestLakeEnvironment';

function createAssets(): LoadedExhibitionAssets {
  return {
    models: new Map(),
    textures: new Map(),
    environment: null,
    audio: new Map(),
    failures: new Map()
  };
}

describe('realistic West Lake environment', () => {
  it('builds the required landscape zones without low-poly landmark primitives', () => {
    const environment = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.high);

    expect(environment.root.children.map((child) => child.name)).toEqual(
      expect.arrayContaining([
        'lake-water',
        'natural-shoreline',
        'su-causeway',
        'stone-arch-bridge',
        'instanced-vegetation',
        'leifeng-pagoda',
        'distant-mountains',
        'atmosphere'
      ])
    );
    expect(environment.root.getObjectByName('trees')).toBeUndefined();
    expect(environment.root.getObjectByName('arch-bridge')).toBeUndefined();
  });

  it('budgets varied instanced vegetation by rendering quality', () => {
    const high = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.high);
    const medium = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.medium);
    const low = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.low);

    expect(high.instancedVegetation.count).toBeGreaterThan(40);
    expect(medium.instancedVegetation.count).toBeLessThan(high.instancedVegetation.count);
    expect(low.instancedVegetation.count).toBeLessThan(medium.instancedVegetation.count);

    const transforms = Array.from(
      { length: Math.min(8, high.instancedVegetation.count) },
      (_, i) => {
        const matrix = new THREE.Matrix4();
        high.instancedVegetation.getMatrixAt(i, matrix);
        return matrix.elements.join(',');
      }
    );
    expect(new Set(transforms).size).toBe(transforms.length);
  });

  it('animates two-direction water and foliage only while motion and its zone are active', () => {
    const environment = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.high);
    const windField = environment.water.userData.windField as {
      directions: THREE.Vector2[];
      offset: THREE.Vector2;
    };

    expect(windField.directions).toHaveLength(2);
    expect(windField.directions[0].equals(windField.directions[1])).toBe(false);

    environment.update(0.5);
    const movingOffset = windField.offset.clone();
    expect(movingOffset.length()).toBeGreaterThan(0);
    expect(environment.foliageUniforms.time.value).toBeGreaterThan(0);

    environment.setReducedMotion(true);
    environment.update(0.5);
    expect(windField.offset.equals(movingOffset)).toBe(true);

    environment.setReducedMotion(false);
    environment.setZoneVisible('lake', false);
    environment.update(0.5);
    expect(windField.offset.equals(movingOffset)).toBe(true);
  });

  it('quality-gates volumetric atmosphere and disposes shared resources once', () => {
    const high = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.high);
    const low = createWestLakeEnvironment(createAssets(), QUALITY_PROFILES.low);
    expect(high.atmosphere.userData.volumetric).toBe(true);
    expect(high.atmosphere.userData.godRays).toBe(true);
    expect(low.atmosphere.userData.volumetric).toBe(false);
    expect(low.atmosphere.userData.godRays).toBe(false);

    const geometry = high.instancedVegetation.geometry;
    const dispose = vi.spyOn(geometry, 'dispose');
    high.dispose();
    high.dispose();
    expect(dispose).toHaveBeenCalledTimes(1);
  });
});
