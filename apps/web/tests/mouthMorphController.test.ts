import { BufferGeometry, Mesh, MeshBasicMaterial, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { createMouthMorphController } from '../src/lab/lip-sync/three/mouthMorphController';

function createFaceMesh() {
  const mesh = new Mesh(new BufferGeometry(), new MeshBasicMaterial());
  mesh.morphTargetDictionary = { jawOpen: 0, mouthOpen: 1, viseme_aa: 2 };
  mesh.morphTargetInfluences = [0, 0, 0];
  return mesh;
}

describe('createMouthMorphController', () => {
  it('drives every jawOpen and mouthOpen target and resets them', () => {
    const root = new Object3D();
    const first = createFaceMesh();
    const second = createFaceMesh();
    root.add(first, second);
    const controller = createMouthMorphController(root);

    expect(controller.bindingCount).toBe(4);

    controller.setOpen(0.65);

    expect(first.morphTargetInfluences).toEqual([0.65, 0.65, 0]);
    expect(second.morphTargetInfluences).toEqual([0.65, 0.65, 0]);

    controller.reset();

    expect(first.morphTargetInfluences).toEqual([0, 0, 0]);
    expect(second.morphTargetInfluences).toEqual([0, 0, 0]);
  });

  it('ignores models without mouth morph targets', () => {
    const controller = createMouthMorphController(new Object3D());

    expect(controller.bindingCount).toBe(0);
    expect(() => controller.setOpen(0.5)).not.toThrow();
    expect(() => controller.reset()).not.toThrow();
  });
});
