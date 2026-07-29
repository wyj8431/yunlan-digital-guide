import { describe, expect, it } from 'vitest';
import { EXHIBITION_LAYOUT, assertMainAisleClear } from '../src/exhibition/exhibitionLayout';
import * as THREE from 'three';
import { applyHallPbrTextures, createHallMaterials } from '../src/exhibition/exhibitionMaterials';
import {
  JIANGNAN_HALL_COLLIDERS,
  createJiangnanHall
} from '../src/exhibition/scene/createJiangnanHall';

describe('realistic Jiangnan hall', () => {
  it('builds the required full-scale architectural groups', () => {
    const hall = createJiangnanHall(createHallMaterials());
    expect(hall.children.map((child) => child.name)).toEqual(
      expect.arrayContaining([
        'architectural-shell',
        'moon-gate',
        'walnut-lattice',
        'stone-floor',
        'ceiling-tracks',
        'west-lake-scroll',
        'wayfinding',
        'fire-exit'
      ])
    );
    expect(hall.userData.dimensions).toEqual({ width: 16, depth: 20, height: 4.8 });
    expect(hall.userData.instancedLatticeCount).toBeGreaterThanOrEqual(24);
  });

  it('preserves the 2.4 metre central aisle', () => {
    expect(assertMainAisleClear(EXHIBITION_LAYOUT, 2.4)).toBe(true);
    expect(JIANGNAN_HALL_COLLIDERS).toHaveLength(4);
    expect(
      JIANGNAN_HALL_COLLIDERS.every((collider) => collider.maxX <= -1.7 || collider.minX >= 1.7)
    ).toBe(true);
  });

  it('calibrates PBR texture color spaces, repeats, and anisotropy', () => {
    const materials = createHallMaterials();
    const textures = new Map<string, THREE.Texture>();
    for (const materialId of ['stone-pbr', 'walnut-pbr']) {
      for (const slot of ['baseColor', 'normal', 'roughness', 'ao']) {
        textures.set(`${materialId}:${slot}`, new THREE.Texture());
      }
    }

    applyHallPbrTextures(materials, textures, 8);

    expect(materials.floor.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(materials.floor.normalMap?.colorSpace).toBe(THREE.NoColorSpace);
    expect(materials.floor.map?.repeat.toArray()).toEqual([8, 10]);
    expect(materials.floor.map?.anisotropy).toBe(8);
    expect(materials.wood.map?.colorSpace).toBe(THREE.SRGBColorSpace);
    expect(materials.wood.map?.repeat.toArray()).toEqual([1.5, 4]);
  });
});
